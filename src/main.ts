import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { importProvidersFrom, enableProdMode } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

enableProdMode();

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(HttpClientModule, BrowserAnimationsModule),
    Title,
  ],
})
  .then(() => {
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error);
        });
    }
  })
  .catch((err) => {
    // Error handling removed - errors will be thrown naturally
  });
