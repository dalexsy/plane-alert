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
 * Product plane motion (map lerp + window-view CSS transitions) defaults on,
 * including kiosk. Continuous decorative FX stay gated separately.
 */
export function kioskDefaultAnimationsEnabled(): boolean {
  return true;
}

/**
 * Continuous decorative systems must never run on the wall display:
 * rain particles, swallows, fall leaves, continuous rotor spin (CSS).
 * Plane position motion is allowed — see effectiveAnimationsEnabled.
 */
export function kioskDecorativeFxLockedOff(): boolean {
  return isKioskMode();
}

/**
 * @deprecated Prefer kioskDecorativeFxLockedOff(). Plane motion is no longer
 * hard-locked on kiosk; only decorative RAF/particle systems are.
 */
export function kioskMotionLockedOff(): boolean {
  return false;
}

/** Stored animation preference — not hard-locked on kiosk. */
export function effectiveAnimationsEnabled(storedEnabled: boolean): boolean {
  return storedEnabled;
}

/**
 * Apply before Angular boot: kiosk paint budget (no always-on blur tax classes).
 * Does not force animations-disabled — product motion may be on.
 */
export function applyKioskDomPerformance(document: Document): void {
  if (!isKioskMode()) {
    return;
  }
  document.body.classList.add('kiosk-mode');
}
