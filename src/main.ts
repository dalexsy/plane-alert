import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { importProvidersFrom, enableProdMode } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

enableProdMode();

function shellAsset(text: string, pattern: RegExp): string | undefined {
  return text.match(pattern)?.[0];
}

async function ensureFreshShell(): Promise<void> {
  const runningMain = document
    .querySelector('script[src*="main-"]')
    ?.getAttribute('src')
    ?.match(/main-[A-Z0-9]+\.js/i)?.[0];
  if (!runningMain) return;

  try {
    const res = await fetch(`/index.html?shell=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const html = await res.text();
    const liveMain = shellAsset(html, /main-[A-Z0-9]+\.js/i);
    const liveStyles = shellAsset(html, /styles-[A-Z0-9]+\.css/i);
    const livePolyfills = shellAsset(html, /polyfills-[A-Z0-9]+\.js/i);
    const runningStyles = shellAsset(document.documentElement.innerHTML, /styles-[A-Z0-9]+\.css/i);
    const runningPolyfills = document
      .querySelector('script[src*="polyfills-"]')
      ?.getAttribute('src')
      ?.match(/polyfills-[A-Z0-9]+\.js/i)?.[0];
    const stale =
      (liveMain && liveMain !== runningMain) ||
      (liveStyles && runningStyles && liveStyles !== runningStyles) ||
      (livePolyfills && runningPolyfills && livePolyfills !== runningPolyfills);
    if (!stale || !liveMain) return;

    const reloaded = sessionStorage.getItem('planes-shell-reload') === liveMain;
    if (reloaded) return;

    sessionStorage.setItem('planes-shell-reload', liveMain);
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    location.reload();
  } catch {
    // offline or auth redirect — keep running bundle
  }
}

void ensureFreshShell().then(() =>
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
  }));
