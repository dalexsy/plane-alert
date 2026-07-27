import { isKioskMode } from '../kiosk-mode/kiosk-mode.util';

export function leafletPanShouldAnimate(appAnimationsEnabled = true): boolean {
  if (isKioskMode()) {
    return false;
  }
  return appAnimationsEnabled;
}
