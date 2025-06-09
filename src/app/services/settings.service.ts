/* src/app/services/settings.service.ts */
import { Injectable, EventEmitter } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  constructor() {
    this.load();
  }
  private _lat: number | null = null;
  private _lon: number | null = null;
  private _radius: number | null = 50;
  private _interval: number = 10; // default to 10 seconds
  private _excludeDiscount: boolean = false;
  private _mapLat: number | null = null;
  private _mapLon: number | null = null;
  private _mapZoom: number = 8;
  private homeLocationKey = 'homeLocation';
  private seenCollapsedKey = 'seenCollapsed';
  private _seenCollapsed: boolean = false;
  private inputOverlayCollapsedKey = 'inputOverlayCollapsed';
  private resultsOverlayCollapsedKey = 'resultsOverlayCollapsed';
  private commercialMuteKey = 'commercialMute';
  private _commercialMute: boolean = false;
  private dateTimeOverlayKey = 'showDateTimeOverlay';
  private _showDateTimeOverlay: boolean = true;
  // Key and backing store for showing view axes (cones)
  private viewAxesKey = 'showViewAxes';
  private _showViewAxes: boolean = false; // Key and backing store for airport labels visibility
  private airportLabelsKey = 'showAirportLabels';
  private _showAirportLabels: boolean = true;

  // Key and backing store for brightness mode preference
  private brightnessAutoModeKey = 'brightnessAutoMode';
  private _brightnessAutoMode: boolean = false;

  // Key and backing store for wind units preference
  private windUnitIndexKey = 'windUnitIndex';
  private _windUnitIndex: number = 0; // Keys and backing stores for cloud and rain cover visibility
  private cloudCoverKey = 'showCloudCover';
  private _showCloudCover: boolean = true;
  private rainCoverKey = 'showRainCover';
  private _showRainCover: boolean = true;
  // Key and backing store for altitude borders visibility
  private altitudeBordersKey = 'showAltitudeBorders';
  private _showAltitudeBorders: boolean = false;
  // Key for clicked airports persistence
  private clickedAirportsKey = 'clickedAirports';

  /** Whether the date/time overlays are shown */
  get showDateTimeOverlay(): boolean {
    return this._showDateTimeOverlay;
  }
  setShowDateTimeOverlay(value: boolean): void {
    this._showDateTimeOverlay = value;
    localStorage.setItem(this.dateTimeOverlayKey, value.toString());
  }
  /** Whether the view axes (cones) are shown */
  get showViewAxes(): boolean {
    return this._showViewAxes;
  }
  setShowViewAxes(value: boolean): void {
    this._showViewAxes = value;
    localStorage.setItem(this.viewAxesKey, value.toString());
  }

  /** Whether the 'All Planes Peeped' list is collapsed */
  get seenCollapsed(): boolean {
    return this._seenCollapsed;
  }
  setSeenCollapsed(value: boolean): void {
    this._seenCollapsed = value;
    localStorage.setItem(this.seenCollapsedKey, value.toString());
  }
  /** Whether the input overlay is collapsed */
  get inputOverlayCollapsed(): boolean {
    const value =
      localStorage.getItem(this.inputOverlayCollapsedKey) === 'true';
    return value;
  }
  setInputOverlayCollapsed(value: boolean): void {
    localStorage.setItem(this.inputOverlayCollapsedKey, value.toString());
  }
  /** Whether the results overlay is collapsed */
  get resultsOverlayCollapsed(): boolean {
    const value =
      localStorage.getItem(this.resultsOverlayCollapsedKey) === 'true';
    return value;
  }
  setResultsOverlayCollapsed(value: boolean): void {
    localStorage.setItem(this.resultsOverlayCollapsedKey, value.toString());
  }

  /** Whether commercial alerts are muted */
  get commercialMute(): boolean {
    return this._commercialMute;
  }
  setCommercialMute(value: boolean): void {
    this._commercialMute = value;
    localStorage.setItem(this.commercialMuteKey, value.toString());
  }

  // Event emitted when exclude discount setting changes
  excludeDiscountChanged = new EventEmitter<boolean>();

  // Event emitted when search radius changes
  radiusChanged = new EventEmitter<number>();

  get lat(): number | null {
    return this._lat;
  }

  setLat(value: number): void {
    this._lat = value;
    localStorage.setItem('lastLat', value.toString());
  }

  get lon(): number | null {
    return this._lon;
  }

  setLon(value: number): void {
    this._lon = value;
    localStorage.setItem('lastLon', value.toString());
  }

  get radius(): number | null {
    return this._radius;
  }

  setRadius(value: number): void {
    this._radius = value;
    localStorage.setItem('lastSearchRadius', value.toString());
    this.radiusChanged.emit(value);
  }

  get interval(): number {
    return this._interval;
  }

  set interval(value: number) {
    this._interval = value;
    localStorage.setItem('checkInterval', value.toString());
  }

  get excludeDiscount(): boolean {
    return this._excludeDiscount;
  }

  set excludeDiscount(value: boolean) {
    if (this._excludeDiscount !== value) {
      this._excludeDiscount = value;
      localStorage.setItem('excludeDiscount', value.toString());
      this.excludeDiscountChanged.emit(value);
    }
  }

  // Explicit setter method in addition to the property setter
  setExcludeDiscount(value: boolean): void {
    // Use the property setter to ensure the event is only emitted if value changes
    this.excludeDiscount = value;
  }

  get mapLat(): number | null {
    return this._mapLat;
  }

  setMapLat(value: number): void {
    this._mapLat = value;
    localStorage.setItem('mapLat', value.toString());
  }

  get mapLon(): number | null {
    return this._mapLon;
  }

  setMapLon(value: number): void {
    this._mapLon = value;
    localStorage.setItem('mapLon', value.toString());
  }

  get mapZoom(): number {
    return this._mapZoom;
  }

  setMapZoom(value: number) {
    this._mapZoom = value;
    localStorage.setItem('mapZoom', value.toString());
  }

  setCurrentLocation(lat: number, lon: number): void {
    localStorage.setItem('currentLocation', JSON.stringify({ lat, lon }));
  }

  getCurrentLocation(): { lat: number; lon: number } | null {
    const saved = localStorage.getItem('currentLocation');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  }

  setHomeLocation(lat: number, lon: number): void {
    localStorage.setItem(this.homeLocationKey, JSON.stringify({ lat, lon }));
  }

  getHomeLocation(): { lat: number; lon: number } | null {
    const saved = localStorage.getItem(this.homeLocationKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  }

  /** Whether airport labels are permanently visible or only on hover */
  get showAirportLabels(): boolean {
    return this._showAirportLabels;
  }
  /** Persist airport labels visibility preference */
  setShowAirportLabels(value: boolean): void {
    this._showAirportLabels = value;
    localStorage.setItem(this.airportLabelsKey, value.toString());
  }
  /** Whether cloud coverage layer is shown */
  get showCloudCover(): boolean {
    return this._showCloudCover;
  }
  /** Persist cloud coverage visibility preference */
  setShowCloudCover(value: boolean): void {
    this._showCloudCover = value;
    localStorage.setItem(this.cloudCoverKey, value.toString());
  } /** Whether rain coverage layer is shown */
  get showRainCover(): boolean {
    return this._showRainCover;
  } /** Persist rain coverage visibility preference */
  setShowRainCover(value: boolean): void {
    this._showRainCover = value;
    localStorage.setItem(this.rainCoverKey, value.toString());
  }

  /** Whether altitude borders are shown */
  get showAltitudeBorders(): boolean {
    return this._showAltitudeBorders;
  }
  /** Persist altitude borders visibility preference */
  setShowAltitudeBorders(value: boolean): void {
    this._showAltitudeBorders = value;
    localStorage.setItem(this.altitudeBordersKey, value.toString());
  }

  /** Whether brightness auto-dimming mode is enabled */
  get brightnessAutoMode(): boolean {
    return this._brightnessAutoMode;
  }
  /** Persist brightness auto-dimming mode preference */
  setBrightnessAutoMode(value: boolean): void {
    this._brightnessAutoMode = value;
    localStorage.setItem(this.brightnessAutoModeKey, value.toString());
  }

  /** Current wind unit index (0: m/s, 1: knots, 2: km/h, 3: mph) */
  get windUnitIndex(): number {
    return this._windUnitIndex;
  }
  /** Persist wind unit preference */
  setWindUnitIndex(value: number): void {
    this._windUnitIndex = value;
    localStorage.setItem(this.windUnitIndexKey, value.toString());
  }

  /** Get clicked airports from localStorage */
  getClickedAirports(): Set<number> {
    const saved = localStorage.getItem(this.clickedAirportsKey);
    if (saved) {
      try {
        const airportIds = JSON.parse(saved) as number[];
        return new Set(airportIds);
      } catch {
        return new Set();
      }
    }
    return new Set();
  }

  /** Save clicked airports to localStorage */
  setClickedAirports(clickedAirports: Set<number>): void {
    const airportIds = Array.from(clickedAirports);
    localStorage.setItem(this.clickedAirportsKey, JSON.stringify(airportIds));
  }

  load(): void {
    // Load airport labels visibility preference
    const labelsStr = localStorage.getItem(this.airportLabelsKey);
    if (labelsStr !== null) {
      this._showAirportLabels = labelsStr === 'true';
    }
    // Load cloud cover visibility preference
    const cloudStr = localStorage.getItem(this.cloudCoverKey);
    if (cloudStr !== null) {
      this._showCloudCover = cloudStr === 'true';
    } // Load rain cover visibility preference
    const rainStr = localStorage.getItem(this.rainCoverKey);
    if (rainStr !== null) {
      this._showRainCover = rainStr === 'true';
    }
    // Load altitude borders visibility preference
    const altitudeBordersStr = localStorage.getItem(this.altitudeBordersKey);
    if (altitudeBordersStr !== null) {
      this._showAltitudeBorders = altitudeBordersStr === 'true';
    }
    const lat = parseFloat(localStorage.getItem('lastLat') || '');
    const lon = parseFloat(localStorage.getItem('lastLon') || '');
    const radius = parseFloat(localStorage.getItem('lastSearchRadius') || '');
    const interval = parseFloat(localStorage.getItem('checkInterval') || '');
    const exclude = localStorage.getItem('excludeDiscount');
    const mapLat = parseFloat(localStorage.getItem('mapLat') || '');
    const mapLon = parseFloat(localStorage.getItem('mapLon') || '');
    const mapZoom = parseFloat(localStorage.getItem('mapZoom') || '');
    if (!isNaN(lat)) {
      this._lat = lat;
    }
    if (!isNaN(lon)) {
      this._lon = lon;
    }
    if (!isNaN(radius)) {
      this._radius = radius;
    }
    if (!isNaN(interval)) {
      this._interval = interval;
    }
    if (exclude !== null) {
      this._excludeDiscount = exclude === 'true';
    }
    if (!isNaN(mapLat)) {
      this._mapLat = mapLat;
    }
    if (!isNaN(mapLon)) {
      this._mapLon = mapLon;
    }
    if (!isNaN(mapZoom)) {
      this._mapZoom = mapZoom;
    }
    // Load seenCollapsed preference
    const seenStr = localStorage.getItem(this.seenCollapsedKey);
    if (seenStr !== null) {
      this._seenCollapsed = seenStr === 'true';
    }
    // Load commercial mute preference
    const muteStr = localStorage.getItem(this.commercialMuteKey);
    if (muteStr !== null) {
      this._commercialMute = muteStr === 'true';
    }
    // Load show/hide date-time overlay preference
    const dtStr = localStorage.getItem(this.dateTimeOverlayKey);
    if (dtStr !== null) {
      this._showDateTimeOverlay = dtStr === 'true';
    } // Load show/hide view axes (cones) preference
    const axesStr = localStorage.getItem(this.viewAxesKey);
    if (axesStr !== null) {
      this._showViewAxes = axesStr === 'true';
    }

    // Load brightness auto-dimming mode preference
    const brightnessStr = localStorage.getItem(this.brightnessAutoModeKey);
    if (brightnessStr !== null) {
      this._brightnessAutoMode = brightnessStr === 'true';
    }

    // Load wind unit preference
    const windUnitStr = localStorage.getItem(this.windUnitIndexKey);
    if (windUnitStr !== null) {
      const windUnitIndex = parseInt(windUnitStr, 10);
      if (!isNaN(windUnitIndex)) {
        this._windUnitIndex = windUnitIndex;
      }
    }
  }
}
