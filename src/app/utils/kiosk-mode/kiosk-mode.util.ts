/** Magicmirror / Pi kiosk launches with ?kiosk=1 — lighter defaults for 24/7 display. */
const KIOSK_SESSION_KEY = 'plane-alert:kiosk';

export function isKioskMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const value = new URLSearchParams(window.location.search).get('kiosk');
  const fromQuery = value === '1' || value === 'true';
  if (fromQuery) {
    try {
      sessionStorage.setItem(KIOSK_SESSION_KEY, '1');
    } catch {
      /* private mode */
    }
    return true;
  }
  try {
    return sessionStorage.getItem(KIOSK_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function kioskDefaultAnimationsEnabled(): boolean {
  return !isKioskMode();
}
