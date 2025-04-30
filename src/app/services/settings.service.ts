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
  private _interval: number = 60;
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
  // Key for persisting show view axes (cone visibility)
  private viewAxesKey = 'showViewAxes';
  private _showViewAxes: boolean = false;

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

  load(): void {
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
    }
    // Load show/hide view axes (cones) preference
    const axesStr = localStorage.getItem(this.viewAxesKey);
    if (axesStr !== null) {
      this._showViewAxes = axesStr === 'true';
    }
  }
}
