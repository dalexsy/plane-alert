import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { importProvidersFrom, enableProdMode } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import {
  BrowserAnimationsModule,
  NoopAnimationsModule,
} from '@angular/platform-browser/animations';
import {
  applyKioskDomPerformance,
  isKioskMode,
} from './app/utils/kiosk-mode/kiosk-mode.util';

enableProdMode();

if (typeof document !== 'undefined') {
  applyKioskDomPerformance(document);
}

async function unregisterServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
}

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
    await unregisterServiceWorkers();
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    location.reload();
  } catch {
    // offline or auth redirect — keep running bundle
  }
}

void ensureFreshShell();
void bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      HttpClientModule,
      isKioskMode() ? NoopAnimationsModule : BrowserAnimationsModule,
    ),
    Title,
  ],
})
  .then(() => {
    // Drop leftover receive-side workers. Alerts are Pushover; do not register /sw.js.
    void unregisterServiceWorkers();
  })
  .catch((err) => {
    // Error handling removed - errors will be thrown naturally
  });
