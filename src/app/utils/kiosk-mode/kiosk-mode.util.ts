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

/**
 * Product plane motion (map lerp + window-view CSS transitions) defaults on
 * for phones/desktop. Kiosk forces motion off — wall display paint budget.
 */
export function kioskDefaultAnimationsEnabled(): boolean {
  return !isKioskMode();
}

/**
 * Continuous decorative systems must never run on the wall display:
 * rain particles, swallows, fall leaves, continuous rotor spin (CSS).
 */
export function kioskDecorativeFxLockedOff(): boolean {
  return isKioskMode();
}

/**
 * @deprecated Prefer kioskDecorativeFxLockedOff().
 */
export function kioskMotionLockedOff(): boolean {
  return isKioskMode();
}

/** Stored animation preference — hard-off on kiosk regardless of localStorage. */
export function effectiveAnimationsEnabled(storedEnabled: boolean): boolean {
  if (isKioskMode()) return false;
  return storedEnabled;
}

/**
 * Apply before Angular boot: kiosk paint budget (no always-on blur tax classes).
 * Also force animations-disabled class for CSS motion kill.
 */
export function applyKioskDomPerformance(document: Document): void {
  if (!isKioskMode()) {
    return;
  }
  document.body.classList.add('kiosk-mode');
  document.body.classList.add('animations-disabled');
}
