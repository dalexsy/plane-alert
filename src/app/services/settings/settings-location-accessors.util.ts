import type { SettingsState } from './settings-load.util';
import type { SettingsEvents } from './settings-accessors.util';
import {
  getFormattedIntervalDisplay,
  getHomeLocation,
  getIntervalInDisplayUnit,
  getViewConesConfig,
  setDistanceUnit,
  setExcludeDiscount,
  setHomeLocation,
  setIntervalFromDisplayUnit,
  setRadius,
  setViewConesConfig,
} from './settings-accessors.util';
import type { ViewConeConfig } from './settings-view-cones.util';

export function bindSettingsLocationAccessors(
  s: SettingsState,
  events: () => SettingsEvents,
) {
  return {
    getLat(): number | null {
      return s._lat;
    },
    setLat(value: number): void {
      s._lat = value;
      localStorage.setItem('lastLat', value.toString());
    },
    getLon(): number | null {
      return s._lon;
    },
    setLon(value: number): void {
      s._lon = value;
      localStorage.setItem('lastLon', value.toString());
    },
    setLocationWithAddress(lat: number, lon: number, address: string): void {
      s._lat = lat;
      s._lon = lon;
      s._currentAddress = address;
      localStorage.setItem('lastLat', lat.toString());
      localStorage.setItem('lastLon', lon.toString());
      localStorage.setItem('currentAddress', address);
    },
    getRadius(): number | null {
      return s._radius;
    },
    setRadiusValue(value: number): void {
      setRadius(s, value, events());
    },
    getInterval(): number {
      return s._interval;
    },
    setIntervalValue(value: number): void {
      s._interval = value;
      localStorage.setItem('checkInterval', value.toString());
    },
    getIntervalInDisplayUnit(): number {
      return getIntervalInDisplayUnit(s);
    },
    setIntervalFromDisplayUnit(value: number): void {
      setIntervalFromDisplayUnit(s, value, events());
    },
    getFormattedIntervalDisplay(): string {
      return getFormattedIntervalDisplay(s);
    },
    getExcludeDiscount(): boolean {
      return s._excludeDiscount;
    },
    setExcludeDiscountValue(value: boolean): void {
      setExcludeDiscount(s, value, events());
    },
    getMapLat(): number | null {
      return s._mapLat;
    },
    setMapLat(value: number): void {
      s._mapLat = value;
      localStorage.setItem('mapLat', value.toString());
    },
    getMapLon(): number | null {
      return s._mapLon;
    },
    setMapLon(value: number): void {
      s._mapLon = value;
      localStorage.setItem('mapLon', value.toString());
    },
    getMapZoom(): number {
      return s._mapZoom;
    },
    setMapZoom(value: number): void {
      s._mapZoom = value;
      localStorage.setItem('mapZoom', value.toString());
    },
    getCurrentAddress(): string | null {
      return s._currentAddress;
    },
    setCurrentAddress(value: string | null): void {
      s._currentAddress = value;
      if (value) localStorage.setItem('currentAddress', value);
      else localStorage.removeItem('currentAddress');
    },
    setHomeLocation(lat: number, lon: number, address?: string): void {
      setHomeLocation(s.homeLocationKey, lat, lon, address);
    },
    getHomeLocation(): { lat: number; lon: number; address?: string } | null {
      return getHomeLocation(s.homeLocationKey);
    },
    getWindUnitIndex(): number {
      return s._windUnitIndex;
    },
    setWindUnitIndex(v: number): void {
      s._windUnitIndex = v;
      localStorage.setItem(s.windUnitIndexKey, v.toString());
    },
    getDistanceUnit(): string {
      return s._distanceUnit;
    },
    setDistanceUnit(value: string): void {
      setDistanceUnit(s, value, events());
    },
    getTimeUnit(): string {
      return s._timeUnit;
    },
    setTimeUnit(value: string): void {
      s._timeUnit = value;
      localStorage.setItem(s.timeUnitKey, value);
    },
    getViewConesConfig(): ViewConeConfig[] {
      return getViewConesConfig(s);
    },
    setViewConesConfig(config: ViewConeConfig[]): void {
      setViewConesConfig(s, config);
    },
  };
}

export type SettingsLocationAccessors = ReturnType<
  typeof bindSettingsLocationAccessors
>;
