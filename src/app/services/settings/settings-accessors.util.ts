import { EventEmitter } from '@angular/core';
import type { SettingsState } from './settings-load.util';
import type { ViewConeConfig } from './settings.service';

export interface SettingsEvents {
  inputOverlayCollapsedChanged: EventEmitter<boolean>;
  resultsOverlayCollapsedChanged: EventEmitter<boolean>;
  inputOverlayControlsChanged: EventEmitter<boolean>;
  resultsOverlayControlsChanged: EventEmitter<boolean>;
  excludeDiscountChanged: EventEmitter<boolean>;
  radiusChanged: EventEmitter<number>;
  distanceUnitChanged: EventEmitter<string>;
}

export function getDateTimeOverlayVisibility(s: SettingsState): boolean {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  if (isMobile && localStorage.getItem(s.dateTimeOverlayMobileKey) === null) return false;
  if (!isMobile && localStorage.getItem(s.dateTimeOverlayKey) === null) return false;
  return isMobile ? s._showDateTimeOverlayMobile : s._showDateTimeOverlay;
}

export function setMilitaryMute(s: SettingsState, value: boolean): void {
  s._militaryMute = value;
  localStorage.setItem(s.militaryMuteKey, value.toString());
  if (value && typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function persistBool(s: SettingsState, key: string, field: keyof SettingsState, value: boolean): void {
  (s as unknown as Record<string, unknown>)[field as string] = value;
  localStorage.setItem(key, value.toString());
}

export function getClickedAirports(s: SettingsState): Set<number> {
  const saved = localStorage.getItem('clickedAirports');
  if (!saved) return new Set();
  try {
    return new Set(JSON.parse(saved) as number[]);
  } catch {
    return new Set();
  }
}

export function setClickedAirports(clickedAirports: Set<number>): void {
  localStorage.setItem('clickedAirports', JSON.stringify(Array.from(clickedAirports)));
}

export function getViewConesConfig(s: SettingsState): ViewConeConfig[] {
  return [...s._viewConesConfig];
}

export function setViewConesConfig(s: SettingsState, config: ViewConeConfig[]): void {
  s._viewConesConfig = [...config];
  localStorage.setItem(s.viewConesKey, JSON.stringify(config));
}

export function getIntervalInDisplayUnit(s: SettingsState): number {
  if (s._timeUnit === 'minutes') return Math.round(s._interval / 60);
  return Math.round(s._interval);
}

export function setIntervalFromDisplayUnit(s: SettingsState, value: number, events?: SettingsEvents): void {
  const intervalInSeconds = s._timeUnit === 'minutes' ? value * 60 : value;
  s._interval = intervalInSeconds;
  localStorage.setItem('checkInterval', intervalInSeconds.toString());
}

export function getFormattedIntervalDisplay(s: SettingsState): string {
  return Math.round(getIntervalInDisplayUnit(s)).toString();
}

export function setExcludeDiscount(s: SettingsState, value: boolean, events: SettingsEvents): void {
  if (s._excludeDiscount === value) return;
  s._excludeDiscount = value;
  localStorage.setItem('excludeDiscount', value.toString());
  events.excludeDiscountChanged.emit(value);
}

export function setRadius(s: SettingsState, value: number, events: SettingsEvents): void {
  s._radius = value;
  localStorage.setItem('lastSearchRadius', value.toString());
  events.radiusChanged.emit(value);
}

export function setDistanceUnit(s: SettingsState, value: string, events: SettingsEvents): void {
  s._distanceUnit = value;
  localStorage.setItem(s.distanceUnitKey, value);
  events.distanceUnitChanged.emit(value);
}

export function getHomeLocation(homeLocationKey: string): {
  lat: number;
  lon: number;
  address?: string;
} | null {
  const saved = localStorage.getItem(homeLocationKey);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  return {
    lat: 52.3667,
    lon: 13.5033,
    address: 'Berlin Brandenburg Airport, Schönefeld, Germany',
  };
}

export function setHomeLocation(
  homeLocationKey: string,
  lat: number,
  lon: number,
  address?: string
): void {
  const homeData: { lat: number; lon: number; address?: string } = { lat, lon };
  if (address) homeData.address = address;
  localStorage.setItem(homeLocationKey, JSON.stringify(homeData));
}
