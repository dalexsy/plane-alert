/* src/app/services/settings.service.ts */
import { Injectable, EventEmitter } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  constructor() {
    this.load();
  }

  /** Event emitted when distance unit changes */
  distanceUnitChanged = new EventEmitter<string>();
  // Event emitted when input overlay collapse state changes
  inputOverlayCollapsedChanged = new EventEmitter<boolean>();
  // Event emitted when results overlay collapse state changes
  resultsOverlayCollapsedChanged = new EventEmitter<boolean>();
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
  private militaryMuteKey = 'militaryMute';
  private _militaryMute: boolean = false;
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
  private _windUnitIndex: number = 0;
  // Key and backing store for distance unit preference
  private distanceUnitKey = 'distanceUnit';
  private _distanceUnit: string = 'km'; // 'km' or 'miles'

  // Key and backing store for time unit preference (for scan interval)
  private timeUnitKey = 'timeUnit';
  private _timeUnit: string = 'seconds'; // 'seconds' or 'minutes'

  // Keys and backing stores for cloud and rain cover visibility
  private cloudCoverKey = 'showCloudCover';
  private _showCloudCover: boolean = true;
  private rainCoverKey = 'showRainCover';
  private _showRainCover: boolean = true;
  // Key and backing store for altitude borders visibility
  private altitudeBordersKey = 'showAltitudeBorders';
  private _showAltitudeBorders: boolean = true;
  // Key and backing store for animations enabled/disabled
  private animationsEnabledKey = 'animationsEnabled';
  private _animationsEnabled: boolean = true;
  // Key for clicked airports persistence
  private clickedAirportsKey = 'clickedAirports';

  // Key and backing store for window view visibility
  private windowViewKey = 'showWindowView';
  private _showWindowView: boolean = true;

  private _inputOverlayCollapsed: boolean = true; // Collapsed by default
  private _resultsOverlayCollapsed: boolean = true; // Collapsed by default

  // Key for input-overlay controls hidden
  private inputOverlayControlsKey = 'inputOverlayOtherControlsHidden';
  private _inputOverlayOtherControlsHidden: boolean = false;
  // Event when input-overlay other controls are hidden/shown
  inputOverlayControlsChanged = new EventEmitter<boolean>();

  // Key for results-overlay controls hidden
  private resultsOverlayControlsKey = 'resultsOverlayOtherControlsHidden';
  private _resultsOverlayOtherControlsHidden: boolean = false;
  // Event when results-overlay other controls are hidden/shown
  resultsOverlayControlsChanged = new EventEmitter<boolean>();

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
    return this._inputOverlayCollapsed;
  }
  /** Persist input overlay collapse state */
  setInputOverlayCollapsed(value: boolean): void {
    this._inputOverlayCollapsed = value;
    localStorage.setItem(this.inputOverlayCollapsedKey, value.toString());
    this.inputOverlayCollapsedChanged.emit(value);
  }
  /** Whether the input overlay other controls are hidden */
  get inputOverlayControlsHidden(): boolean {
    return this._inputOverlayOtherControlsHidden;
  }
  /** Persist input overlay other controls hidden state */
  setInputOverlayControlsHidden(value: boolean): void {
    this._inputOverlayOtherControlsHidden = value;
    localStorage.setItem(this.inputOverlayControlsKey, value.toString());
    this.inputOverlayControlsChanged.emit(value);
  }
  /** Whether the results overlay is collapsed */
  get resultsOverlayCollapsed(): boolean {
    return this._resultsOverlayCollapsed;
  }
  /** Persist results overlay collapse state */
  setResultsOverlayCollapsed(value: boolean): void {
    this._resultsOverlayCollapsed = value;
    localStorage.setItem(this.resultsOverlayCollapsedKey, value.toString());
    this.resultsOverlayCollapsedChanged.emit(value);
  }
  /** Whether the results overlay other controls are hidden */
  get resultsOverlayControlsHidden(): boolean {
    return this._resultsOverlayOtherControlsHidden;
  }
  /** Persist results overlay other controls hidden state */
  setResultsOverlayControlsHidden(value: boolean): void {
    this._resultsOverlayOtherControlsHidden = value;
    localStorage.setItem(this.resultsOverlayControlsKey, value.toString());
    this.resultsOverlayControlsChanged.emit(value);
  }
  /** Whether military alerts are muted */
  get militaryMute(): boolean {
    return this._militaryMute;
  }
  setMilitaryMute(value: boolean): void {
    this._militaryMute = value;
    localStorage.setItem(this.militaryMuteKey, value.toString());
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
  } /** Get interval in the currently selected display unit (seconds or minutes) */
  getIntervalInDisplayUnit(): number {
    if (this._timeUnit === 'minutes') {
      const minutes = this._interval / 60;
      // Round to whole minutes only for simplicity
      return Math.round(minutes);
    }
    return Math.round(this._interval);
  }

  /** Set interval from display unit value (converts to seconds for storage) */
  setIntervalFromDisplayUnit(value: number): void {
    const intervalInSeconds = this._timeUnit === 'minutes' ? value * 60 : value;
    this.interval = intervalInSeconds;
  }
  /** Get formatted interval display value as string with appropriate precision and no locale commas */
  getFormattedIntervalDisplay(): string {
    const value = this.getIntervalInDisplayUnit();
    // Always return whole numbers as strings to avoid locale formatting issues
    return Math.round(value).toString();
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

  /** Whether animations are enabled */
  get animationsEnabled(): boolean {
    return this._animationsEnabled;
  }
  /** Persist animations enabled preference */
  setAnimationsEnabled(value: boolean): void {
    this._animationsEnabled = value;
    localStorage.setItem(this.animationsEnabledKey, value.toString());
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
  /** Current distance unit ('km' or 'miles') */
  get distanceUnit(): string {
    return this._distanceUnit;
  }
  /** Persist distance unit preference */
  setDistanceUnit(value: string): void {
    this._distanceUnit = value;
    localStorage.setItem(this.distanceUnitKey, value);
    this.distanceUnitChanged.emit(value);
  }

  /** Current time unit for scan interval ('seconds' or 'minutes') */
  get timeUnit(): string {
    return this._timeUnit;
  }
  /** Persist time unit preference */
  setTimeUnit(value: string): void {
    this._timeUnit = value;
    localStorage.setItem(this.timeUnitKey, value);
  }

  /** Whether the window view overlay is shown */
  get showWindowView(): boolean {
    return this._showWindowView;
  }
  setShowWindowView(value: boolean): void {
    this._showWindowView = value;
    localStorage.setItem(this.windowViewKey, value.toString());
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
    // Load animations enabled preference
    const animationsStr = localStorage.getItem(this.animationsEnabledKey);
    if (animationsStr !== null) {
      this._animationsEnabled = animationsStr === 'true';
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
    } // Load military mute preference
    const muteStr = localStorage.getItem(this.militaryMuteKey);
    if (muteStr !== null) {
      this._militaryMute = muteStr === 'true';
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
    } // Load wind unit preference
    const windUnitStr = localStorage.getItem(this.windUnitIndexKey);
    if (windUnitStr !== null) {
      const windUnitIndex = parseInt(windUnitStr, 10);
      if (!isNaN(windUnitIndex)) {
        this._windUnitIndex = windUnitIndex;
      }
    } // Load distance unit preference
    const distanceUnitStr = localStorage.getItem(this.distanceUnitKey);
    if (distanceUnitStr !== null) {
      this._distanceUnit = distanceUnitStr;
    }

    // Load time unit preference
    const timeUnitStr = localStorage.getItem(this.timeUnitKey);
    if (timeUnitStr !== null) {
      this._timeUnit = timeUnitStr;
    }
    // Load show/hide window view preference
    const windowViewStr = localStorage.getItem(this.windowViewKey);
    if (windowViewStr !== null) {
      this._showWindowView = windowViewStr === 'true';
    }
    // Load input overlay collapsed preference
    const inputOverlayCollapsedStr = localStorage.getItem(
      this.inputOverlayCollapsedKey
    );
    if (inputOverlayCollapsedStr !== null) {
      this._inputOverlayCollapsed = inputOverlayCollapsedStr === 'true';
    }
    // Load input overlay other controls hidden preference
    const inputControlsStr = localStorage.getItem(this.inputOverlayControlsKey);
    if (inputControlsStr !== null) {
      this._inputOverlayOtherControlsHidden = inputControlsStr === 'true';
    }
    // Load results overlay collapsed preference
    const resultsOverlayCollapsedStr = localStorage.getItem(
      this.resultsOverlayCollapsedKey
    );
    if (resultsOverlayCollapsedStr !== null) {
      this._resultsOverlayCollapsed = resultsOverlayCollapsedStr === 'true';
    }
    // Load results overlay other controls hidden preference
    const resultsControlsStr = localStorage.getItem(
      this.resultsOverlayControlsKey
    );
    if (resultsControlsStr !== null) {
      this._resultsOverlayOtherControlsHidden = resultsControlsStr === 'true';
    }
  }
}
