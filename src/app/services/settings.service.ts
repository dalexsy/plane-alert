/* src/app/services/settings.service.ts */
import { Injectable, EventEmitter } from '@angular/core';
import { loadSettingsFromStorage } from './settings/settings-load.util';
import {
  getClickedAirports,
  getDateTimeOverlayVisibility,
  getFormattedIntervalDisplay,
  getHomeLocation,
  getIntervalInDisplayUnit,
  getViewConesConfig,
  persistBool,
  setClickedAirports,
  setDistanceUnit,
  setExcludeDiscount,
  setHomeLocation,
  setIntervalFromDisplayUnit,
  setMilitaryMute,
  setRadius,
  setViewConesConfig,
} from './settings/settings-accessors.util';

export interface ViewConeConfig {
  startAngle: number;
  endAngle: number;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  distanceUnitChanged = new EventEmitter<string>();
  inputOverlayCollapsedChanged = new EventEmitter<boolean>();
  resultsOverlayCollapsedChanged = new EventEmitter<boolean>();
  inputOverlayControlsChanged = new EventEmitter<boolean>();
  resultsOverlayControlsChanged = new EventEmitter<boolean>();
  excludeDiscountChanged = new EventEmitter<boolean>();
  radiusChanged = new EventEmitter<number>();

  private _lat: number | null = null;
  private _lon: number | null = null;
  private _currentAddress: string | null = null;
  private _radius: number | null = 100;
  private _interval = 60;
  private _excludeDiscount = false;
  private _mapLat: number | null = null;
  private _mapLon: number | null = null;
  private _mapZoom = 8;
  private homeLocationKey = 'homeLocation';
  seenCollapsedKey = 'seenCollapsed';
  private _seenCollapsed = true;
  inputOverlayCollapsedKey = 'inputOverlayCollapsed';
  resultsOverlayCollapsedKey = 'resultsOverlayCollapsed';
  militaryMuteKey = 'militaryMute';
  private _militaryMute = false;
  dateTimeOverlayKey = 'showDateTimeOverlay';
  private _showDateTimeOverlay = false;
  dateTimeOverlayMobileKey = 'showDateTimeOverlayMobile';
  private _showDateTimeOverlayMobile = false;
  windDirectionKey = 'showWindDirection';
  private _showWindDirection = true;
  sunDirectionKey = 'showSunDirection';
  private _showSunDirection = true;
  useAutoLocationKey = 'useAutoLocation';
  private _useAutoLocation = false;
  viewAxesKey = 'showViewAxes';
  private _showViewAxes = false;
  airportLabelsKey = 'showAirportLabels';
  private _showAirportLabels = false;
  brightnessAutoModeKey = 'brightnessAutoMode';
  private _brightnessAutoMode = false;
  windUnitIndexKey = 'windUnitIndex';
  private _windUnitIndex = 0;
  distanceUnitKey = 'distanceUnit';
  private _distanceUnit = 'km';
  timeUnitKey = 'timeUnit';
  private _timeUnit = 'seconds';
  cloudCoverKey = 'showCloudCover';
  private _showCloudCover = false;
  rainCoverKey = 'showRainCover';
  private _showRainCover = false;
  altitudeBordersKey = 'showAltitudeBorders';
  private _showAltitudeBorders = true;
  animationsEnabledKey = 'animationsEnabled';
  private _animationsEnabled = true;
  private clickedAirportsKey = 'clickedAirports';
  windowViewKey = 'showWindowView';
  private _showWindowView = true;
  private _inputOverlayCollapsed = false;
  private _resultsOverlayCollapsed = false;
  inputOverlayControlsKey = 'inputOverlayOtherControlsHidden';
  private _inputOverlayOtherControlsHidden = false;
  resultsOverlayControlsKey = 'resultsOverlayOtherControlsHidden';
  private _resultsOverlayOtherControlsHidden = false;
  viewConesKey = 'viewConesConfig';
  private _viewConesConfig: ViewConeConfig[] = [
    { startAngle: 75, endAngle: 190, label: 'Balcony' },
    { startAngle: 245, endAngle: 345, label: 'Streetside' },
  ];

  constructor() {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    if (isMobile) {
      this._inputOverlayCollapsed = true;
      this._resultsOverlayCollapsed = true;
    }
    this.load();
  }

  private events() {
    return {
      inputOverlayCollapsedChanged: this.inputOverlayCollapsedChanged,
      resultsOverlayCollapsedChanged: this.resultsOverlayCollapsedChanged,
      inputOverlayControlsChanged: this.inputOverlayControlsChanged,
      resultsOverlayControlsChanged: this.resultsOverlayControlsChanged,
      excludeDiscountChanged: this.excludeDiscountChanged,
      radiusChanged: this.radiusChanged,
      distanceUnitChanged: this.distanceUnitChanged,
    };
  }

  get showDateTimeOverlay(): boolean { return this._showDateTimeOverlay; }
  setShowDateTimeOverlay(v: boolean): void { persistBool(this, this.dateTimeOverlayKey, '_showDateTimeOverlay', v); }
  get showDateTimeOverlayMobile(): boolean { return this._showDateTimeOverlayMobile; }
  setShowDateTimeOverlayMobile(v: boolean): void { persistBool(this, this.dateTimeOverlayMobileKey, '_showDateTimeOverlayMobile', v); }
  getDateTimeOverlayVisibility(): boolean { return getDateTimeOverlayVisibility(this); }
  get showWindDirection(): boolean { return this._showWindDirection; }
  setShowWindDirection(v: boolean): void { persistBool(this, this.windDirectionKey, '_showWindDirection', v); }
  get showSunDirection(): boolean { return this._showSunDirection; }
  setShowSunDirection(v: boolean): void { persistBool(this, this.sunDirectionKey, '_showSunDirection', v); }
  get useAutoLocation(): boolean { return this._useAutoLocation; }
  setUseAutoLocation(v: boolean): void { persistBool(this, this.useAutoLocationKey, '_useAutoLocation', v); }
  get showViewAxes(): boolean { return this._showViewAxes; }
  setShowViewAxes(v: boolean): void { persistBool(this, this.viewAxesKey, '_showViewAxes', v); }
  get seenCollapsed(): boolean { return this._seenCollapsed; }
  setSeenCollapsed(v: boolean): void { persistBool(this, this.seenCollapsedKey, '_seenCollapsed', v); }
  get inputOverlayCollapsed(): boolean { return this._inputOverlayCollapsed; }
  setInputOverlayCollapsed(v: boolean): void {
    persistBool(this, this.inputOverlayCollapsedKey, '_inputOverlayCollapsed', v);
    this.inputOverlayCollapsedChanged.emit(v);
  }
  get inputOverlayControlsHidden(): boolean { return this._inputOverlayOtherControlsHidden; }
  setInputOverlayControlsHidden(v: boolean): void {
    persistBool(this, this.inputOverlayControlsKey, '_inputOverlayOtherControlsHidden', v);
    this.inputOverlayControlsChanged.emit(v);
  }
  get resultsOverlayCollapsed(): boolean { return this._resultsOverlayCollapsed; }
  setResultsOverlayCollapsed(v: boolean): void {
    persistBool(this, this.resultsOverlayCollapsedKey, '_resultsOverlayCollapsed', v);
    this.resultsOverlayCollapsedChanged.emit(v);
  }
  get resultsOverlayControlsHidden(): boolean { return this._resultsOverlayOtherControlsHidden; }
  setResultsOverlayControlsHidden(v: boolean): void {
    persistBool(this, this.resultsOverlayControlsKey, '_resultsOverlayOtherControlsHidden', v);
    this.resultsOverlayControlsChanged.emit(v);
  }
  get militaryMute(): boolean { return this._militaryMute; }
  setMilitaryMute(v: boolean): void { setMilitaryMute(this, v); }

  get lat(): number | null { return this._lat; }
  setLat(value: number): void { this._lat = value; localStorage.setItem('lastLat', value.toString()); }
  get lon(): number | null { return this._lon; }
  setLon(value: number): void { this._lon = value; localStorage.setItem('lastLon', value.toString()); }
  setLocationWithAddress(lat: number, lon: number, address: string): void {
    this._lat = lat; this._lon = lon; this._currentAddress = address;
    localStorage.setItem('lastLat', lat.toString());
    localStorage.setItem('lastLon', lon.toString());
    localStorage.setItem('currentAddress', address);
  }
  get radius(): number | null { return this._radius; }
  setRadius(value: number): void { setRadius(this, value, this.events()); }
  get interval(): number { return this._interval; }
  set interval(value: number) { this._interval = value; localStorage.setItem('checkInterval', value.toString()); }
  getIntervalInDisplayUnit(): number { return getIntervalInDisplayUnit(this); }
  setIntervalFromDisplayUnit(value: number): void { setIntervalFromDisplayUnit(this, value, this.events()); }
  getFormattedIntervalDisplay(): string { return getFormattedIntervalDisplay(this); }
  get excludeDiscount(): boolean { return this._excludeDiscount; }
  set excludeDiscount(value: boolean) { setExcludeDiscount(this, value, this.events()); }
  setExcludeDiscount(value: boolean): void { this.excludeDiscount = value; }
  get mapLat(): number | null { return this._mapLat; }
  setMapLat(value: number): void { this._mapLat = value; localStorage.setItem('mapLat', value.toString()); }
  get mapLon(): number | null { return this._mapLon; }
  setMapLon(value: number): void { this._mapLon = value; localStorage.setItem('mapLon', value.toString()); }
  get mapZoom(): number { return this._mapZoom; }
  setMapZoom(value: number): void { this._mapZoom = value; localStorage.setItem('mapZoom', value.toString()); }
  get currentAddress(): string | null { return this._currentAddress; }
  setCurrentAddress(value: string | null): void {
    this._currentAddress = value;
    if (value) localStorage.setItem('currentAddress', value);
    else localStorage.removeItem('currentAddress');
  }
  setHomeLocation(lat: number, lon: number, address?: string): void {
    setHomeLocation(this.homeLocationKey, lat, lon, address);
  }
  getHomeLocation(): { lat: number; lon: number; address?: string } | null {
    return getHomeLocation(this.homeLocationKey);
  }
  get showAirportLabels(): boolean { return this._showAirportLabels; }
  setShowAirportLabels(v: boolean): void { persistBool(this, this.airportLabelsKey, '_showAirportLabels', v); }
  get showCloudCover(): boolean { return this._showCloudCover; }
  setShowCloudCover(v: boolean): void { persistBool(this, this.cloudCoverKey, '_showCloudCover', v); }
  get showRainCover(): boolean { return this._showRainCover; }
  setShowRainCover(v: boolean): void { persistBool(this, this.rainCoverKey, '_showRainCover', v); }
  get showAltitudeBorders(): boolean { return this._showAltitudeBorders; }
  setShowAltitudeBorders(v: boolean): void { persistBool(this, this.altitudeBordersKey, '_showAltitudeBorders', v); }
  get animationsEnabled(): boolean { return this._animationsEnabled; }
  setAnimationsEnabled(v: boolean): void { persistBool(this, this.animationsEnabledKey, '_animationsEnabled', v); }
  get brightnessAutoMode(): boolean { return this._brightnessAutoMode; }
  setBrightnessAutoMode(v: boolean): void { persistBool(this, this.brightnessAutoModeKey, '_brightnessAutoMode', v); }
  get windUnitIndex(): number { return this._windUnitIndex; }
  setWindUnitIndex(v: number): void { this._windUnitIndex = v; localStorage.setItem(this.windUnitIndexKey, v.toString()); }
  getClickedAirports(): Set<number> { return getClickedAirports(this); }
  setClickedAirports(clicked: Set<number>): void { setClickedAirports(clicked); }
  get distanceUnit(): string { return this._distanceUnit; }
  setDistanceUnit(value: string): void { setDistanceUnit(this, value, this.events()); }
  get timeUnit(): string { return this._timeUnit; }
  setTimeUnit(value: string): void { this._timeUnit = value; localStorage.setItem(this.timeUnitKey, value); }
  get showWindowView(): boolean { return this._showWindowView; }
  setShowWindowView(v: boolean): void { persistBool(this, this.windowViewKey, '_showWindowView', v); }
  get viewConesConfig(): ViewConeConfig[] { return getViewConesConfig(this); }
  setViewConesConfig(config: ViewConeConfig[]): void { setViewConesConfig(this, config); }
  load(): void { loadSettingsFromStorage(this); }
}
