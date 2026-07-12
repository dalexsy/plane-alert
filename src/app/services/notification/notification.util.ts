import { DistanceUnit } from '../../utils/units/units.util';
import { formatNotificationBody, getCountryFlagEmoji } from '@plane-alert/shared';
import type { CountryService } from '../country/country.service';
import type { SettingsService } from '../settings/settings.service';

export type MilitaryPlaneInfo = {
  icao: string;
  callsign?: string;
  model?: string;
  operator?: string;
  altitude?: number;
  speed?: number;
  direction?: string;
  distanceKm?: number;
  origin?: string;
  verticalRate?: number;
};

export function buildMilitaryNotificationTitle(label: string): string {
  const upper = label.toUpperCase();
  if (upper.includes('A400') || upper.includes('A-400')) return '🦜 ' + label;
  if (upper.includes('E-3') || upper.includes('SENTRY')) return '🛸 ' + label;
  return label || 'Military Plane Alert';
}

export function buildMilitaryNotificationBody(
  planeInfo: MilitaryPlaneInfo,
  settings: SettingsService,
  countryService: CountryService
): string {
  const unitPreference = settings.distanceUnit === 'miles' ? DistanceUnit.MILES : DistanceUnit.KILOMETERS;
  const callsign = planeInfo.callsign?.trim() || planeInfo.icao;
  const countryCode = planeInfo.origin || extractCountryCode(planeInfo.operator, countryService);
  const flagEmoji = countryCode ? getCountryFlagEmoji(countryCode) : '🏳️';
  let speed: number | undefined;
  let speedUnit: 'mph' | 'km/h';
  if (planeInfo.speed && planeInfo.speed > 0) {
    speed = Math.round(planeInfo.speed);
    speedUnit = unitPreference === DistanceUnit.MILES ? 'mph' : 'km/h';
  } else {
    speedUnit = unitPreference === DistanceUnit.MILES ? 'mph' : 'km/h';
  }
  let altitude: number | undefined;
  let altitudeUnit: 'ft' | 'm';
  if (planeInfo.altitude && planeInfo.altitude > 0) {
    altitude = Math.round(planeInfo.altitude);
    altitudeUnit = unitPreference === DistanceUnit.MILES ? 'ft' : 'm';
  } else {
    altitudeUnit = unitPreference === DistanceUnit.MILES ? 'ft' : 'm';
  }
  return formatNotificationBody({
    callsign, icao: planeInfo.icao, direction: planeInfo.direction, flagEmoji,
    operator: planeInfo.operator, speed, speedUnit, altitude, altitudeUnit, verticalRate: planeInfo.verticalRate,
  });
}

function extractCountryCode(operator: string | undefined, countryService: CountryService): string | null {
  if (!operator) return null;
  let candidate = operator.trim();
  const parenMatch = candidate.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1].trim().length > 2) candidate = parenMatch[1].trim();
  if (candidate.includes(' - ')) candidate = candidate.split(' - ')[0].trim();
  if (candidate.includes(',')) {
    const parts = candidate.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length) candidate = parts[parts.length - 1];
  }
  candidate = candidate.replace(/\s+/g, ' ').trim();
  return countryService.getCountryCode(candidate) || null;
}

export async function detectIncognitoMode(): Promise<boolean> {
  if (!navigator.storage?.estimate) return false;
  try {
    const { quota } = await navigator.storage.estimate();
    return typeof quota === 'number' && quota > 0 && quota < 120_000_000;
  } catch {
    return false;
  }
}

export function spawnWindowNotification(title: string, options: NotificationOptions): void {
  try {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      const targetUrl = options.data?.link || '/';
      if (window.parent && window.parent !== window) {
        window.parent.focus();
        window.parent.location.href = targetUrl;
      } else {
        window.focus();
        window.location.href = targetUrl;
      }
      notification.close();
    };
    setTimeout(() => notification.close(), 5000);
  } catch (error) {
    console.warn('Window notification failed:', error);
  }
}

export type NotificationState =
  | 'unsupported'
  | 'pwa-required'
  | 'prompt'
  | 'granted'
  | 'blocked'
  | 'incognito-blocked';

export interface NotificationStatusInfo {
  state: NotificationState;
  icon: string;
  label: string;
  details: string;
  canRequest: boolean;
  canTest: boolean;
}

export async function evaluateNotificationStatus(): Promise<NotificationStatusInfo> {
  if (!('Notification' in window)) {
    return {
      state: 'unsupported', icon: '❌', label: 'Notifications not supported',
      details: 'Your browser does not support the Notifications API.', canRequest: false, canTest: false,
    };
  }
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  if (isIOS && !isStandalone) {
    return {
      state: 'pwa-required', icon: '📲', label: 'Install to enable alerts',
      details: 'Add PlaneAlert to your home screen to turn on notifications in iOS.', canRequest: false, canTest: false,
    };
  }
  const permission = Notification.permission;
  if (permission === 'granted') {
    return {
      state: 'granted', icon: '✅', label: 'Notifications enabled',
      details: 'Ready to alert you when military planes are nearby.', canRequest: false, canTest: true,
    };
  }
  if (permission === 'denied') {
    if (await detectIncognitoMode()) {
      return {
        state: 'incognito-blocked', icon: '🚫', label: 'Blocked in private window',
        details: 'Chrome automatically blocks notifications in Incognito. Open PlaneAlert in a regular window to enable alerts.',
        canRequest: false, canTest: false,
      };
    }
    return {
      state: 'blocked', icon: '🚫', label: 'Notifications blocked',
      details: 'Notifications are turned off for PlaneAlert. Enable them in the browser site settings, then tap the button again.',
      canRequest: true, canTest: false,
    };
  }
  return {
    state: 'prompt', icon: '🔔', label: 'Notifications available',
    details: 'Click the button below to enable military plane alerts.', canRequest: true, canTest: false,
  };
}
