/* src/app/services/settings/settings.service.ts */
import { Injectable, EventEmitter } from '@angular/core';
import type { SettingsState } from './settings-load.util';
import { isKioskMode, kioskDefaultAnimationsEnabled } from '../../utils/kiosk-mode/kiosk-mode.util';
import { loadSettingsFromStorage } from './settings-load.util';
import {
  DEFAULT_VIEW_CONES,
  type ViewConeConfig,
} from './settings-view-cones.util';
import { bindSettingsOverlayAccessors } from './settings-overlay-accessors.util';
import { bindSettingsLocationAccessors } from './settings-location-accessors.util';
import { defineSettingsPublicApi } from './settings-public-api.util';
export type { ViewConeConfig } from './settings-view-cones.util';
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
  homeLocationKey = 'homeLocation';
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
  showGhostPositionKey = 'showGhostPosition'; private _showGhostPosition = false;
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
  private _viewConesConfig: ViewConeConfig[] = [...DEFAULT_VIEW_CONES];
  declare showDateTimeOverlay: boolean;
  declare setShowDateTimeOverlay: (v: boolean) => void;
  declare showDateTimeOverlayMobile: boolean;
  declare setShowDateTimeOverlayMobile: (v: boolean) => void;
  declare getDateTimeOverlayVisibility: () => boolean;
  declare showWindDirection: boolean;
  declare setShowWindDirection: (v: boolean) => void;
  declare showSunDirection: boolean;
  declare setShowSunDirection: (v: boolean) => void;
  declare useAutoLocation: boolean;
  declare setUseAutoLocation: (v: boolean) => void;
  declare showViewAxes: boolean;
  declare setShowViewAxes: (v: boolean) => void;
  declare seenCollapsed: boolean;
  declare setSeenCollapsed: (v: boolean) => void;
  declare inputOverlayCollapsed: boolean;
  declare setInputOverlayCollapsed: (v: boolean) => void;
  declare inputOverlayControlsHidden: boolean;
  declare setInputOverlayControlsHidden: (v: boolean) => void;
  declare resultsOverlayCollapsed: boolean;
  declare setResultsOverlayCollapsed: (v: boolean) => void;
  declare resultsOverlayControlsHidden: boolean;
  declare setResultsOverlayControlsHidden: (v: boolean) => void;
  declare militaryMute: boolean;
  declare setMilitaryMute: (v: boolean) => void;
  declare lat: number | null;
  declare setLat: (value: number) => void;
  declare lon: number | null;
  declare setLon: (value: number) => void;
  declare setLocationWithAddress: (lat: number, lon: number, address: string) => void;
  declare radius: number | null;
  declare setRadius: (value: number) => void;
  declare interval: number;
  declare getIntervalInDisplayUnit: () => number;
  declare setIntervalFromDisplayUnit: (value: number) => void;
  declare getFormattedIntervalDisplay: () => string;
  declare excludeDiscount: boolean;
  declare setExcludeDiscount: (value: boolean) => void;
  declare mapLat: number | null;
  declare setMapLat: (value: number) => void;
  declare mapLon: number | null;
  declare setMapLon: (value: number) => void;
  declare mapZoom: number;
  declare setMapZoom: (value: number) => void;
  declare currentAddress: string | null;
  declare setCurrentAddress: (value: string | null) => void;
  declare setHomeLocation: (lat: number, lon: number, address?: string) => void;
  declare getHomeLocation: () => { lat: number; lon: number; address?: string } | null;
  declare showAirportLabels: boolean;
  declare setShowAirportLabels: (v: boolean) => void;
  declare showCloudCover: boolean;
  declare setShowCloudCover: (v: boolean) => void;
  declare showRainCover: boolean;
  declare setShowRainCover: (v: boolean) => void;
  declare showAltitudeBorders: boolean;
  declare setShowAltitudeBorders: (v: boolean) => void;
  declare animationsEnabled: boolean;
  declare setAnimationsEnabled: (v: boolean) => void;
  declare showGhostPosition: boolean;
  declare setShowGhostPosition: (v: boolean) => void;
  declare brightnessAutoMode: boolean;
  declare setBrightnessAutoMode: (v: boolean) => void;
  declare windUnitIndex: number;
  declare setWindUnitIndex: (v: number) => void;
  declare getClickedAirports: () => Set<number>;
  declare setClickedAirports: (clicked: Set<number>) => void;
  declare distanceUnit: string;
  declare setDistanceUnit: (value: string) => void;
  declare timeUnit: string;
  declare setTimeUnit: (value: string) => void;
  declare showWindowView: boolean;
  declare setShowWindowView: (v: boolean) => void;
  declare viewConesConfig: ViewConeConfig[];
  declare setViewConesConfig: (config: ViewConeConfig[]) => void;
  constructor() {
    const overlay = bindSettingsOverlayAccessors(this.asState(), {
      inputOverlayCollapsedChanged: this.inputOverlayCollapsedChanged,
      inputOverlayControlsChanged: this.inputOverlayControlsChanged,
      resultsOverlayCollapsedChanged: this.resultsOverlayCollapsedChanged,
      resultsOverlayControlsChanged: this.resultsOverlayControlsChanged,
    });
    const location = bindSettingsLocationAccessors(this.asState(), () =>
      this.events(),
    );
    defineSettingsPublicApi(this, overlay, location, () => this.asState());
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
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
  private asState(): SettingsState {
    return this as unknown as SettingsState;
  }
  load(): void {
    loadSettingsFromStorage(this.asState());
    if (isKioskMode()) {
      this._animationsEnabled = kioskDefaultAnimationsEnabled();
      localStorage.setItem(this.animationsEnabledKey, String(this._animationsEnabled));
    }
  }
}
