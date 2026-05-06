/* src/app/services/settings.service.ts */
import {
  Injectable,
  EventEmitter,
  Inject,
  Optional,
  Injector,
} from '@angular/core';

export interface ViewConeConfig {
  startAngle: number;
  endAngle: number;
  label: string;
}

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  constructor(private injector: Injector) {
    // Set mobile-specific defaults
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    if (isMobile) {
      this._inputOverlayCollapsed = true; // Collapsed by default on mobile
      this._resultsOverlayCollapsed = true; // Collapsed by default on mobile
    }
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
  private _currentAddress: string | null = null;
  private _radius: number | null = 100;
  private _interval: number = 60; // default to 60 seconds
  private _excludeDiscount: boolean = false;
  private _mapLat: number | null = null;
  private _mapLon: number | null = null;
  private _mapZoom: number = 8;
  private locationKey = 'currentLocation'; // Unified location storage
  private homeLocationKey = 'homeLocation';
  private seenCollapsedKey = 'seenCollapsed';
  private _seenCollapsed: boolean = true; // Collapsed by default
  private inputOverlayCollapsedKey = 'inputOverlayCollapsed';
  private resultsOverlayCollapsedKey = 'resultsOverlayCollapsed';
  private militaryMuteKey = 'militaryMute';
  private _militaryMute: boolean = true;
  private mutedIcaosKey = 'mutedIcaos';
  private _mutedIcaos: Set<string> = new Set();
  private dateTimeOverlayKey = 'showDateTimeOverlay';
  private _showDateTimeOverlay: boolean = false;
  private dateTimeOverlayMobileKey = 'showDateTimeOverlayMobile';
  private _showDateTimeOverlayMobile: boolean = false;
  private windDirectionKey = 'showWindDirection';
  private _showWindDirection: boolean = true;
  private sunDirectionKey = 'showSunDirection';
  private _showSunDirection: boolean = true;
  private useAutoLocationKey = 'useAutoLocation';
  private _useAutoLocation: boolean = false;
  // Key and backing store for showing view axes (cones)
  private viewAxesKey = 'showViewAxes';
  private _showViewAxes: boolean = false; // Key and backing store for airport labels visibility
  private airportLabelsKey = 'showAirportLabels';
  private _showAirportLabels: boolean = false;

  // Key and backing store for brightness mode preference
  private brightnessAutoModeKey = 'brightnessAutoMode';
  private _brightnessAutoMode: boolean = false; // Disable auto mode by default
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
  private _showCloudCover: boolean = false;
  private rainCoverKey = 'showRainCover';
  private _showRainCover: boolean = false;
  // Key and backing store for altitude borders visibility
  private altitudeBordersKey = 'showAltitudeBorders';
  private _showAltitudeBorders: boolean = true;
  // Key and backing store for animations enabled/disabled
  private animationsEnabledKey = 'animationsEnabled';
  private _animationsEnabled: boolean = true;
  // Key and backing store for ghost position (onion skin) overlay
  private showGhostPositionKey = 'showGhostPosition';
  private _showGhostPosition: boolean = false;
  // Key for clicked airports persistence
  private clickedAirportsKey = 'clickedAirports';

  // Key and backing store for window view visibility
  private windowViewKey = 'showWindowView';
  private _showWindowView: boolean = true;

  private _inputOverlayCollapsed: boolean = false; // Open by default on desktop
  private _resultsOverlayCollapsed: boolean = false; // Open by default on desktop

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

  // Key and backing store for view cones configuration
  private viewConesKey = 'viewConesConfig';
  private _viewConesConfig: ViewConeConfig[] = [
    { startAngle: 75, endAngle: 190, label: 'Balcony' },
    { startAngle: 245, endAngle: 345, label: 'Streetside' },
  ];

  /** Whether the date/time overlays are shown */
  get showDateTimeOverlay(): boolean {
    return this._showDateTimeOverlay;
  }
  setShowDateTimeOverlay(value: boolean): void {
    this._showDateTimeOverlay = value;
    localStorage.setItem(this.dateTimeOverlayKey, value.toString());
  }

  /** Whether the date/time overlays are shown on mobile */
  get showDateTimeOverlayMobile(): boolean {
    return this._showDateTimeOverlayMobile;
  }
  setShowDateTimeOverlayMobile(value: boolean): void {
    this._showDateTimeOverlayMobile = value;
    localStorage.setItem(this.dateTimeOverlayMobileKey, value.toString());
  }

  /** Get date/time overlay visibility based on device */
  getDateTimeOverlayVisibility(): boolean {
    const isMobile = window.innerWidth <= 768;

    // If no preference has been set yet, default to hidden
    if (
      isMobile &&
      localStorage.getItem(this.dateTimeOverlayMobileKey) === null
    ) {
      return false;
    }
    if (!isMobile && localStorage.getItem(this.dateTimeOverlayKey) === null) {
      return false;
    }

    return isMobile
      ? this._showDateTimeOverlayMobile
      : this._showDateTimeOverlay;
  }

  /** Whether the wind direction is shown */
  get showWindDirection(): boolean {
    return this._showWindDirection;
  }
  setShowWindDirection(value: boolean): void {
    this._showWindDirection = value;
    localStorage.setItem(this.windDirectionKey, value.toString());
  }

  /** Whether the sun direction is shown */
  get showSunDirection(): boolean {
    return this._showSunDirection;
  }
  setShowSunDirection(value: boolean): void {
    this._showSunDirection = value;
    localStorage.setItem(this.sunDirectionKey, value.toString());
  }

  /** Whether to automatically update location each scan */
  get useAutoLocation(): boolean {
    return this._useAutoLocation;
  }
  setUseAutoLocation(value: boolean): void {
    this._useAutoLocation = value;
    localStorage.setItem(this.useAutoLocationKey, value.toString());
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

    // Cancel all ongoing TTS when muting
    if (value && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  /** Whether a specific ICAO is muted */
  isMutedIcao(icao: string): boolean {
    return this._mutedIcaos.has(icao.toUpperCase());
  }

  /** Get all muted ICAOs */
  getMutedIcaos(): string[] {
    return Array.from(this._mutedIcaos);
  }

  /** Mute or unmute a specific ICAO */
  toggleMutedIcao(icao: string): void {
    const key = icao.toUpperCase();
    if (this._mutedIcaos.has(key)) {
      this._mutedIcaos.delete(key);
    } else {
      this._mutedIcaos.add(key);
    }
    localStorage.setItem(this.mutedIcaosKey, JSON.stringify(Array.from(this._mutedIcaos)));
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

  /**
   * Set location (lat, lon) and address together atomically
   * This ensures coordinates and address are always in sync
   * Also updates backend notification location
   */
  async setLocationWithAddress(
    lat: number,
    lon: number,
    address: string,
  ): Promise<void> {
    this._lat = lat;
    this._lon = lon;
    this._currentAddress = address;
    localStorage.setItem('lastLat', lat.toString());
    localStorage.setItem('lastLon', lon.toString());
    localStorage.setItem('currentAddress', address);

    // Update backend notification location
    try {
      const firebaseMessaging = (await import('./firebase-messaging.service'))
        .FirebaseMessagingService;
      const messagingService = this.injector.get(firebaseMessaging);
      await messagingService.updateCurrentLocation(lat, lon, address);
    } catch (error) {
      console.warn('Failed to update backend location:', error);
    }
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

  get currentAddress(): string | null {
    return this._currentAddress;
  }

  setCurrentAddress(value: string | null): void {
    this._currentAddress = value;
    if (value) {
      localStorage.setItem('currentAddress', value);
    } else {
      localStorage.removeItem('currentAddress');
    }
  }

  async setHomeLocation(
    lat: number,
    lon: number,
    address?: string,
  ): Promise<void> {
    const homeData: any = { lat, lon };
    if (address) {
      homeData.address = address;
    }
    localStorage.setItem(this.homeLocationKey, JSON.stringify(homeData));

    console.log('🏠 Home location updated:', { lat, lon, address });

    // Update backend notification location (only if push notifications are enabled)
    try {
      const firebaseMessaging = (await import('./firebase-messaging.service'))
        .FirebaseMessagingService;
      const messagingService = this.injector.get(firebaseMessaging);

      // Only update if there's an active token (push notifications enabled)
      if (messagingService.hasActiveToken()) {
        const updated = await messagingService.updateCurrentLocation(
          lat,
          lon,
          address,
        );
        if (updated) {
          console.log(
            '✅ Backend location synchronized for push notifications',
          );
        } else {
          console.warn('⚠️ Failed to sync location with backend');
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not update backend location:', error);
    }
  }

  getHomeLocation(): { lat: number; lon: number; address?: string } | null {
    const saved = localStorage.getItem(this.homeLocationKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    // No default fallback - user must explicitly set their location for push notifications
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

  /** Whether ghost position (onion skin) overlay is shown */
  get showGhostPosition(): boolean {
    return this._showGhostPosition;
  }
  /** Persist ghost position overlay preference */
  setShowGhostPosition(value: boolean): void {
    this._showGhostPosition = value;
    localStorage.setItem(this.showGhostPositionKey, value.toString());
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

  /** Get view cones configuration */
  get viewConesConfig(): ViewConeConfig[] {
    return [...this._viewConesConfig];
  }

  /** Set view cones configuration */
  setViewConesConfig(config: ViewConeConfig[]): void {
    this._viewConesConfig = [...config];
    localStorage.setItem(this.viewConesKey, JSON.stringify(config));
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
    // Load ghost position overlay preference
    const ghostStr = localStorage.getItem(this.showGhostPositionKey);
    if (ghostStr !== null) {
      this._showGhostPosition = ghostStr === 'true';
    }
    // Try to load from unified location object first
    const unifiedLocation = localStorage.getItem(this.locationKey);
    let lat: number,
      lon: number,
      currentAddress: string | null = null;

    if (unifiedLocation) {
      try {
        const locationData = JSON.parse(unifiedLocation);
        lat = parseFloat(locationData.lat);
        lon = parseFloat(locationData.lon);
        currentAddress = locationData.address || null;
      } catch {
        // Fall back to individual keys if JSON parse fails
        lat = parseFloat(localStorage.getItem('lastLat') || '');
        lon = parseFloat(localStorage.getItem('lastLon') || '');
        currentAddress = localStorage.getItem('currentAddress');
      }
    } else {
      // Fall back to individual keys for backwards compatibility
      lat = parseFloat(localStorage.getItem('lastLat') || '');
      lon = parseFloat(localStorage.getItem('lastLon') || '');
      currentAddress = localStorage.getItem('currentAddress');
    }

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
    if (currentAddress) {
      this._currentAddress = currentAddress;
    }
    if (!isNaN(radius)) {
      this._radius = radius;
    }
    if (!isNaN(interval)) {
      // Migrate old interval values: ensure minimum 60 seconds to match backend collection frequency
      this._interval = Math.max(60, interval);
      // Update localStorage if value was migrated
      if (interval < 60) {
        localStorage.setItem('checkInterval', '60');
      }
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
    // currentAddress is now loaded earlier with lat/lon from unified location
    // Load seenCollapsed preference
    const seenStr = localStorage.getItem(this.seenCollapsedKey);
    if (seenStr !== null) {
      this._seenCollapsed = seenStr === 'true';
    } // Load military mute preference
    const muteStr = localStorage.getItem(this.militaryMuteKey);
    if (muteStr !== null) {
      this._militaryMute = muteStr === 'true';
    }
    // Load muted ICAOs
    const mutedIcaosStr = localStorage.getItem(this.mutedIcaosKey);
    if (mutedIcaosStr !== null) {
      try {
        const arr = JSON.parse(mutedIcaosStr);
        if (Array.isArray(arr)) {
          this._mutedIcaos = new Set(arr.map((v: string) => v.toUpperCase()));
        }
      } catch {
        this._mutedIcaos = new Set();
      }
    }
    // Load show/hide date-time overlay preference
    const dtStr = localStorage.getItem(this.dateTimeOverlayKey);
    if (dtStr !== null) {
      this._showDateTimeOverlay = dtStr === 'true';
    }

    // Load show/hide date-time overlay mobile preference
    const dtMobileStr = localStorage.getItem(this.dateTimeOverlayMobileKey);
    if (dtMobileStr !== null) {
      this._showDateTimeOverlayMobile = dtMobileStr === 'true';
    }

    // Load show/hide wind direction preference
    const windDirStr = localStorage.getItem(this.windDirectionKey);
    if (windDirStr !== null) {
      this._showWindDirection = windDirStr === 'true';
    }

    // Load show/hide sun direction preference
    const sunDirStr = localStorage.getItem(this.sunDirectionKey);
    if (sunDirStr !== null) {
      this._showSunDirection = sunDirStr === 'true';
    }

    // Load auto-location update preference
    const autoLocationStr = localStorage.getItem(this.useAutoLocationKey);
    if (autoLocationStr !== null) {
      this._useAutoLocation = autoLocationStr === 'true';
    }

    // Load show/hide view axes (cones) preference
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
      this.inputOverlayCollapsedKey,
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
      this.resultsOverlayCollapsedKey,
    );
    if (resultsOverlayCollapsedStr !== null) {
      this._resultsOverlayCollapsed = resultsOverlayCollapsedStr === 'true';
    }
    // Load results overlay other controls hidden preference
    const resultsControlsStr = localStorage.getItem(
      this.resultsOverlayControlsKey,
    );
    if (resultsControlsStr !== null) {
      this._resultsOverlayOtherControlsHidden = resultsControlsStr === 'true';
    }

    // Load view cones configuration
    const conesConfigStr = localStorage.getItem(this.viewConesKey);
    if (conesConfigStr !== null) {
      try {
        this._viewConesConfig = JSON.parse(conesConfigStr);
      } catch {
        // Keep default config if parsing fails
      }
    }
  }
}
