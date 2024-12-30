import {
  enableProdMode,
  ErrorHandler,
  importProvidersFrom,
  LOCALE_ID,
  SecurityContext,
} from '@angular/core';

import { environment } from './environments/environment';
import { IS_ELECTRON } from './app/app.constants';
import { IS_ANDROID_WEB_VIEW } from './app/util/is-android-web-view';
import { androidInterface } from './app/features/android/android-interface';
import { ElectronAPI } from '../electron/electronAPI.d';
import { App as CapacitorApp } from '@capacitor/app';
import { GlobalErrorHandler } from './app/core/error-handler/global-error-handler.class';
import {
  bootstrapApplication,
  BrowserModule,
  HAMMER_GESTURE_CONFIG,
  HammerModule,
} from '@angular/platform-browser';
import { MyHammerConfig } from './hammer-config.class';
import {
  HttpClient,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { MarkdownModule, MARKED_OPTIONS, provideMarkdown } from 'ngx-markdown';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { FeatureStoresModule } from './app/root-store/feature-stores.module';
import { MatMomentDateModule } from '@angular/material-moment-adapter';
import { MatNativeDateModule } from '@angular/material/core';
import { FormlyConfigModule } from './app/ui/formly-config.module';
import { markedOptionsFactory } from './app/ui/marked-options-factory';
import { MaterialCssVarsModule } from 'angular-material-css-vars';
import { MatSidenavModule } from '@angular/material/sidenav';
import { ReminderModule } from './app/features/reminder/reminder.module';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withHashLocation } from '@angular/router';
import { APP_ROUTES } from './app/app.routes';
import { StoreModule } from '@ngrx/store';
import { reducers } from './app/root-store';
import { undoTaskDeleteMetaReducer } from './app/root-store/meta/undo-task-delete.meta-reducer';
import { actionLoggerReducer } from './app/root-store/meta/action-logger.reducer';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { ReactiveFormsModule } from '@angular/forms';
import { FormlyModule } from '@ngx-formly/core';
import { ServiceWorkerModule } from '@angular/service-worker';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { AppComponent } from './app/app.component';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { ShortTime2Pipe } from './app/ui/pipes/short-time2.pipe';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

if (environment.production || environment.stage) {
  enableProdMode();
}

declare global {
  interface Window {
    ea: ElectronAPI;
  }
}

const createTranslateLoader = (http: HttpClient): TranslateHttpLoader =>
  new TranslateHttpLoader(http, './assets/i18n/', '.json');

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      FeatureStoresModule,
      MatMomentDateModule,
      MatNativeDateModule,
      FormlyConfigModule,
      MarkdownModule.forRoot({
        markedOptions: {
          provide: MARKED_OPTIONS,
          useFactory: markedOptionsFactory,
        },
        sanitize: SecurityContext.HTML,
      }),
      MaterialCssVarsModule.forRoot(),
      MatSidenavModule,
      ReminderModule,
      MaterialCssVarsModule.forRoot(),
      // External
      BrowserModule,
      HammerModule,
      // NOTE: both need to be present to use forFeature stores
      StoreModule.forRoot(reducers, {
        metaReducers: [undoTaskDeleteMetaReducer, actionLoggerReducer],
        ...(environment.production
          ? {
              runtimeChecks: {
                strictStateImmutability: false,
                strictActionImmutability: false,
                strictStateSerializability: false,
                strictActionSerializability: false,
              },
            }
          : {
              runtimeChecks: {
                strictStateImmutability: true,
                strictActionImmutability: true,
                strictStateSerializability: true,
                strictActionSerializability: true,
              },
            }),
      }),
      EffectsModule.forRoot([]),
      !environment.production && !environment.stage
        ? StoreDevtoolsModule.instrument({ connectInZone: true })
        : [],
      ReactiveFormsModule,
      FormlyModule.forRoot({
        extras: {
          immutable: true,
        },
        validationMessages: [{ name: 'pattern', message: 'Invalid input' }],
      }),
      ServiceWorkerModule.register('ngsw-worker.js', {
        enabled:
          !IS_ELECTRON &&
          !IS_ANDROID_WEB_VIEW &&
          (environment.production || environment.stage),
        // Register the ServiceWorker as soon as the application is stable
        // or after 30 seconds (whichever comes first).
        registrationStrategy: 'registerWhenStable:30000',
      }),
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: createTranslateLoader,
          deps: [HttpClient],
        },
      }),
      CdkDropListGroup,
    ),
    { provide: LOCALE_ID, useValue: navigator.language },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: HAMMER_GESTURE_CONFIG, useClass: MyHammerConfig },
    provideHttpClient(withInterceptorsFromDi()),
    // TODO check if these can be removed
    DatePipe,
    ShortTime2Pipe,
    provideCharts(withDefaultRegisterables()),
    provideMarkdown(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'fill', subscriptSizing: 'dynamic' },
    },
    { provide: HAMMER_GESTURE_CONFIG, useClass: MyHammerConfig },
    provideAnimations(),
    provideRouter(APP_ROUTES, withHashLocation()),
  ],
})
  .then(() => {
    // TODO make asset caching work for electron
    if (
      'serviceWorker' in navigator &&
      (environment.production || environment.stage) &&
      !IS_ELECTRON &&
      !IS_ANDROID_WEB_VIEW
    ) {
      console.log('Registering Service worker');
      return navigator.serviceWorker.register('ngsw-worker.js');
    } else if ('serviceWorker' in navigator && (IS_ELECTRON || IS_ANDROID_WEB_VIEW)) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        })
        .catch((e) => {
          console.error('ERROR when unregistering service worker');
          console.error(e);
        });
    }
    return;
  })
  .catch((err: any) => {
    console.log('Service Worker Registration Error');
    console.log(err);
  });

// fix mobile scrolling while dragging
window.addEventListener('touchmove', () => {});

if (!(environment.production || environment.stage) && IS_ANDROID_WEB_VIEW) {
  setTimeout(() => {
    androidInterface.showToast('Android DEV works');
    console.log(androidInterface);
  }, 1000);
}

// CAPICATOR STUFF
// ---------------
if (IS_ANDROID_WEB_VIEW) {
  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (!canGoBack) {
      CapacitorApp.minimizeApp();
    } else {
      window.history.back();
    }
  });
}
