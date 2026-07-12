/** Magicmirror / Pi kiosk launches with ?kiosk=1 — lighter defaults for 24/7 display. */
export function isKioskMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const value = new URLSearchParams(window.location.search).get('kiosk');
  return value === '1' || value === 'true';
}

export function kioskDefaultAnimationsEnabled(): boolean {
  return !isKioskMode();
}
