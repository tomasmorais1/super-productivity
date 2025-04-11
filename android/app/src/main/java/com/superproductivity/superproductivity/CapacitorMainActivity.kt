package com.superproductivity.superproductivity

import android.content.Intent
import android.graphics.Color
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.ServiceWorkerClient
import android.webkit.ServiceWorkerController
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.addCallback
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.anggrayudi.storage.SimpleStorageHelper
import com.getcapacitor.BridgeActivity
import com.getcapacitor.BridgeWebViewClient
import com.superproductivity.superproductivity.util.printWebViewVersion
import com.superproductivity.superproductivity.webview.JavaScriptInterface
import com.superproductivity.superproductivity.webview.WebHelper
import com.superproductivity.superproductivity.webview.WebViewRequestHandler

/**
 * All new Super-Productivity main activity, based on Capacitor to support offline use of the entire application
 */
class CapacitorMainActivity : BridgeActivity() {
    private lateinit var javaScriptInterface: JavaScriptInterface

    private var webViewRequestHandler = WebViewRequestHandler(this, "localhost")
    private val storageHelper =
        SimpleStorageHelper(this) // for scoped storage permission management on Android 10+

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        printWebViewVersion(bridge.webView)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            WindowCompat.setDecorFitsSystemWindows(window, true)
            window.decorView.systemUiVisibility = 0 // Reset system UI flags
            window.statusBarColor = Color.BLACK
            WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars =
                false
        }

        // Register Plugin
        // TODO: The changes to the compatible logic are too complex, so they will not be added for now
        //  (separate branch, there will be opportunities to add it later)
        // DEBUG ONLY
        if (BuildConfig.DEBUG) {
            Toast.makeText(this, "DEBUG: Offline Mode", Toast.LENGTH_SHORT).show()
            WebView.setWebContentsDebuggingEnabled(true)
        }

        // Hide the action bar
        supportActionBar?.hide()

        // Initialize JavaScriptInterface
        javaScriptInterface = JavaScriptInterface(this, bridge.webView, storageHelper)

        // Initialize WebView
        WebHelper().setupView(bridge.webView, false)

        // Inject JavaScriptInterface into Capacitor's WebView
        bridge.webView.addJavascriptInterface(
            javaScriptInterface,
            WINDOW_INTERFACE_PROPERTY
        )
        if (BuildConfig.FLAVOR.equals("fdroid")) {
            bridge.webView.addJavascriptInterface(
                javaScriptInterface,
                WINDOW_PROPERTY_F_DROID
            )
            // not ready in time, that's why we create a second JS interface just to fill the prop
            // callJavaScriptFunction("window.$WINDOW_PROPERTY_F_DROID=true")
        }

        // Set custom SP WebViewClient & ServiceWorkerController
        // No need to set up WebChromeClient, as most of the processes have been implemented in Bridge
        bridge.webViewClient = object : BridgeWebViewClient(bridge) {
            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                return webViewRequestHandler.handleUrlLoading(view, url)
            }

            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                Log.v("TW", "Regular Request Intercepting request: ${request?.url}")
                val interceptedResponse = webViewRequestHandler.interceptWebRequest(request)
                return interceptedResponse ?: super.shouldInterceptRequest(view, request)
            }
        }
        val swController = ServiceWorkerController.getInstance()
        swController.setServiceWorkerClient(
            object : ServiceWorkerClient() {
                override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse? {
                    Log.v("TW", "SW Intercepting request: ${request.url}")
                    val interceptedResponse = webViewRequestHandler.interceptWebRequest(request)
                    return interceptedResponse
                        ?: bridge.webViewClient.shouldInterceptRequest(bridge.webView, request)
                }
            })

        // Register OnBackPressedCallback to handle back button press
        onBackPressedDispatcher.addCallback(this) {
            Log.v("TW", "onBackPressed ${bridge.webView.canGoBack()}")
            if (bridge.webView.canGoBack()) {
                bridge.webView.goBack()
            } else {
                isEnabled = false
                onBackPressedDispatcher.onBackPressed()
            }
        }

        // Handle keyboard visibility changes
        val rootView = findViewById<View>(android.R.id.content)
        rootView.viewTreeObserver.addOnGlobalLayoutListener {
            val rect = Rect()
            rootView.getWindowVisibleDisplayFrame(rect)
            val screenHeight = rootView.rootView.height

            val keypadHeight = screenHeight - rect.bottom
            if (keypadHeight > screenHeight * 0.15) {
                // keyboard is opened
                callJSInterfaceFunctionIfExists("next", "isKeyboardShown$", "true")
            } else {
                // keyboard is closed
                callJSInterfaceFunctionIfExists("next", "isKeyboardShown$", "false")
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        // Save scoped storage permission on Android 10+
        storageHelper.onSaveInstanceState(outState)
        bridge.webView.saveState(outState)
    }

    override fun onRestoreInstanceState(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        // Restore scoped storage permission on Android 10+
        storageHelper.onRestoreInstanceState(savedInstanceState)
        bridge.webView.restoreState(savedInstanceState)
    }

    override fun onPause() {
        super.onPause()
        Log.v("TW", "CapacitorFullscreenActivity: onPause")
        callJSInterfaceFunctionIfExists("next", "onPause$")
    }

    override fun onResume() {
        super.onResume()
        Log.v("TW", "CapacitorFullscreenActivity: onResume")
        callJSInterfaceFunctionIfExists("next", "onResume$")
    }

    private fun callJSInterfaceFunctionIfExists(
        fnName: String,
        objectPath: String,
        fnParam: String = ""
    ) {
        val fnFullName =
            "window.${FullscreenActivity.WINDOW_INTERFACE_PROPERTY}.$objectPath.$fnName"
        val fullObjectPath = "window.${FullscreenActivity.WINDOW_INTERFACE_PROPERTY}.$objectPath"
        javaScriptInterface.callJavaScriptFunction("if($fullObjectPath && $fnFullName)$fnFullName($fnParam)")
    }


    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (data != null) {
            javaScriptInterface.onActivityResult(requestCode, resultCode, data)
        }
    }

    companion object {
        const val WINDOW_INTERFACE_PROPERTY: String = "SUPAndroid"
        const val WINDOW_PROPERTY_F_DROID: String = "SUPFDroid"
    }
}
