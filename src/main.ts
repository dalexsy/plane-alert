import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { importProvidersFrom, enableProdMode } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

enableProdMode();

async function registerServiceWorkerSafely(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const swResponse = await fetch('/sw.js', { cache: 'no-store' });
    if (!swResponse.ok) {
      console.warn(
        'Service worker script not available, skipping registration',
      );
      return;
    }
  } catch {
    console.warn('Service worker precheck failed, skipping registration');
    return;
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('🔄 Service Worker updated - reloading to clear old cache...');
    window.location.reload();
  });

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      updateViaCache: 'none',
    });
    console.log('Service Worker registered:', registration);
    registration.update();
    setInterval(
      () => {
        registration.update();
      },
      60 * 60 * 1000,
    );
  } catch (error) {
    console.warn('Service Worker registration skipped:', error);
  }
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(HttpClientModule, BrowserAnimationsModule),
    Title,
  ],
})
  .then(async () => {
    await registerServiceWorkerSafely();
  })
  .catch((err) => {
    console.error('Angular bootstrap failed:', err);
    throw err;
  });
