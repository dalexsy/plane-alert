import type { ViewConeConfig } from './settings.service';

export interface SettingsState {
  _lat: number | null;
  _lon: number | null;
  _currentAddress: string | null;
  _radius: number | null;
  _interval: number;
  _excludeDiscount: boolean;
  _mapLat: number | null;
  _mapLon: number | null;
  _mapZoom: number;
  _seenCollapsed: boolean;
  _militaryMute: boolean;
  _showDateTimeOverlay: boolean;
  _showDateTimeOverlayMobile: boolean;
  _showWindDirection: boolean;
  _showSunDirection: boolean;
  _useAutoLocation: boolean;
  _showViewAxes: boolean;
  _showAirportLabels: boolean;
  _brightnessAutoMode: boolean;
  _windUnitIndex: number;
  _distanceUnit: string;
  _timeUnit: string;
  _showCloudCover: boolean;
  _showRainCover: boolean;
  _showAltitudeBorders: boolean;
  _animationsEnabled: boolean;
  _showGhostPosition: boolean;
  _showWindowView: boolean;
  _inputOverlayCollapsed: boolean;
  _resultsOverlayCollapsed: boolean;
  _inputOverlayOtherControlsHidden: boolean;
  _resultsOverlayOtherControlsHidden: boolean;
  _viewConesConfig: ViewConeConfig[];
  airportLabelsKey: string;
  cloudCoverKey: string;
  rainCoverKey: string;
  altitudeBordersKey: string;
  animationsEnabledKey: string;
  showGhostPositionKey: string;
  seenCollapsedKey: string;
  militaryMuteKey: string;
  dateTimeOverlayKey: string;
  dateTimeOverlayMobileKey: string;
  windDirectionKey: string;
  sunDirectionKey: string;
  useAutoLocationKey: string;
  viewAxesKey: string;
  brightnessAutoModeKey: string;
  windUnitIndexKey: string;
  distanceUnitKey: string;
  timeUnitKey: string;
  windowViewKey: string;
  inputOverlayCollapsedKey: string;
  inputOverlayControlsKey: string;
  resultsOverlayCollapsedKey: string;
  resultsOverlayControlsKey: string;
  viewConesKey: string;
  homeLocationKey: string;
}

export function loadSettingsFromStorage(s: SettingsState): void {
  const bool = (key: string, field: keyof SettingsState) => {
    const v = localStorage.getItem(key);
    if (v !== null) {
      (s as unknown as Record<string, unknown>)[field as string] = v === 'true';
    }
  };
  bool(s.airportLabelsKey, '_showAirportLabels');
  bool(s.cloudCoverKey, '_showCloudCover');
  bool(s.rainCoverKey, '_showRainCover');
  bool(s.altitudeBordersKey, '_showAltitudeBorders');
  bool(s.animationsEnabledKey, '_animationsEnabled');
  bool(s.showGhostPositionKey, '_showGhostPosition');
  bool(s.seenCollapsedKey, '_seenCollapsed');
  bool(s.militaryMuteKey, '_militaryMute');
  bool(s.dateTimeOverlayKey, '_showDateTimeOverlay');
  bool(s.dateTimeOverlayMobileKey, '_showDateTimeOverlayMobile');
  bool(s.windDirectionKey, '_showWindDirection');
  bool(s.sunDirectionKey, '_showSunDirection');
  bool(s.useAutoLocationKey, '_useAutoLocation');
  bool(s.viewAxesKey, '_showViewAxes');
  bool(s.brightnessAutoModeKey, '_brightnessAutoMode');
  bool(s.windowViewKey, '_showWindowView');
  bool(s.inputOverlayCollapsedKey, '_inputOverlayCollapsed');
  bool(s.inputOverlayControlsKey, '_inputOverlayOtherControlsHidden');
  bool(s.resultsOverlayCollapsedKey, '_resultsOverlayCollapsed');
  bool(s.resultsOverlayControlsKey, '_resultsOverlayOtherControlsHidden');

  const lat = parseFloat(localStorage.getItem('lastLat') || '');
  const lon = parseFloat(localStorage.getItem('lastLon') || '');
  const radius = parseFloat(localStorage.getItem('lastSearchRadius') || '');
  const interval = parseFloat(localStorage.getItem('checkInterval') || '');
  const exclude = localStorage.getItem('excludeDiscount');
  const mapLat = parseFloat(localStorage.getItem('mapLat') || '');
  const mapLon = parseFloat(localStorage.getItem('mapLon') || '');
  const mapZoom = parseFloat(localStorage.getItem('mapZoom') || '');
  const currentAddress = localStorage.getItem('currentAddress');
  if (!isNaN(lat)) s._lat = lat;
  if (!isNaN(lon)) s._lon = lon;
  if (!isNaN(radius)) s._radius = radius;
  if (!isNaN(interval)) s._interval = interval;
  if (exclude !== null) s._excludeDiscount = exclude === 'true';
  if (!isNaN(mapLat)) s._mapLat = mapLat;
  if (!isNaN(mapLon)) s._mapLon = mapLon;
  if (!isNaN(mapZoom)) s._mapZoom = mapZoom;
  if (currentAddress) s._currentAddress = currentAddress;

  const windUnitStr = localStorage.getItem(s.windUnitIndexKey);
  if (windUnitStr !== null) {
    const windUnitIndex = parseInt(windUnitStr, 10);
    if (!isNaN(windUnitIndex)) s._windUnitIndex = windUnitIndex;
  }
  const distanceUnitStr = localStorage.getItem(s.distanceUnitKey);
  if (distanceUnitStr !== null) s._distanceUnit = distanceUnitStr;
  const timeUnitStr = localStorage.getItem(s.timeUnitKey);
  if (timeUnitStr !== null) s._timeUnit = timeUnitStr;

  const conesConfigStr = localStorage.getItem(s.viewConesKey);
  if (conesConfigStr !== null) {
    try {
      s._viewConesConfig = JSON.parse(conesConfigStr);
    } catch {
      /* keep default */
    }
  }
}
