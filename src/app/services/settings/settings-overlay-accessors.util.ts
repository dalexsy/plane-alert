import { EventEmitter } from '@angular/core';
import type { SettingsState } from './settings-load.util';
import {
  getDateTimeOverlayVisibility,
  persistBool,
  setMilitaryMute,
} from './settings-accessors.util';
import { effectiveAnimationsEnabled } from '../../utils/kiosk-mode/kiosk-mode.util';

export function bindSettingsOverlayAccessors(
  s: SettingsState,
  emitters: {
    inputOverlayCollapsedChanged: EventEmitter<boolean>;
    inputOverlayControlsChanged: EventEmitter<boolean>;
    resultsOverlayCollapsedChanged: EventEmitter<boolean>;
    resultsOverlayControlsChanged: EventEmitter<boolean>;
  },
) {
  return {
    getShowDateTimeOverlay(): boolean {
      return s._showDateTimeOverlay;
    },
    setShowDateTimeOverlay(v: boolean): void {
      persistBool(s, s.dateTimeOverlayKey, '_showDateTimeOverlay', v);
    },
    getShowDateTimeOverlayMobile(): boolean {
      return s._showDateTimeOverlayMobile;
    },
    setShowDateTimeOverlayMobile(v: boolean): void {
      persistBool(s, s.dateTimeOverlayMobileKey, '_showDateTimeOverlayMobile', v);
    },
    getDateTimeOverlayVisibility(): boolean {
      return getDateTimeOverlayVisibility(s);
    },
    getShowWindDirection(): boolean {
      return s._showWindDirection;
    },
    setShowWindDirection(v: boolean): void {
      persistBool(s, s.windDirectionKey, '_showWindDirection', v);
    },
    getShowSunDirection(): boolean {
      return s._showSunDirection;
    },
    setShowSunDirection(v: boolean): void {
      persistBool(s, s.sunDirectionKey, '_showSunDirection', v);
    },
    getUseAutoLocation(): boolean {
      return s._useAutoLocation;
    },
    setUseAutoLocation(v: boolean): void {
      persistBool(s, s.useAutoLocationKey, '_useAutoLocation', v);
    },
    getShowViewAxes(): boolean {
      return s._showViewAxes;
    },
    setShowViewAxes(v: boolean): void {
      persistBool(s, s.viewAxesKey, '_showViewAxes', v);
    },
    getSeenCollapsed(): boolean {
      return s._seenCollapsed;
    },
    setSeenCollapsed(v: boolean): void {
      persistBool(s, s.seenCollapsedKey, '_seenCollapsed', v);
    },
    getInputOverlayCollapsed(): boolean {
      return s._inputOverlayCollapsed;
    },
    setInputOverlayCollapsed(v: boolean): void {
      persistBool(s, s.inputOverlayCollapsedKey, '_inputOverlayCollapsed', v);
      emitters.inputOverlayCollapsedChanged.emit(v);
    },
    getInputOverlayControlsHidden(): boolean {
      return s._inputOverlayOtherControlsHidden;
    },
    setInputOverlayControlsHidden(v: boolean): void {
      persistBool(
        s,
        s.inputOverlayControlsKey,
        '_inputOverlayOtherControlsHidden',
        v,
      );
      emitters.inputOverlayControlsChanged.emit(v);
    },
    getResultsOverlayCollapsed(): boolean {
      return s._resultsOverlayCollapsed;
    },
    setResultsOverlayCollapsed(v: boolean): void {
      persistBool(s, s.resultsOverlayCollapsedKey, '_resultsOverlayCollapsed', v);
      emitters.resultsOverlayCollapsedChanged.emit(v);
    },
    getResultsOverlayControlsHidden(): boolean {
      return s._resultsOverlayOtherControlsHidden;
    },
    setResultsOverlayControlsHidden(v: boolean): void {
      persistBool(
        s,
        s.resultsOverlayControlsKey,
        '_resultsOverlayOtherControlsHidden',
        v,
      );
      emitters.resultsOverlayControlsChanged.emit(v);
    },
    getMilitaryMute(): boolean {
      return s._militaryMute;
    },
    setMilitaryMute(v: boolean): void {
      setMilitaryMute(s, v);
    },
    getShowAirportLabels(): boolean {
      return s._showAirportLabels;
    },
    setShowAirportLabels(v: boolean): void {
      persistBool(s, s.airportLabelsKey, '_showAirportLabels', v);
    },
    getShowCloudCover(): boolean {
      return s._showCloudCover;
    },
    setShowCloudCover(v: boolean): void {
      persistBool(s, s.cloudCoverKey, '_showCloudCover', v);
    },
    getShowRainCover(): boolean {
      return s._showRainCover;
    },
    setShowRainCover(v: boolean): void {
      persistBool(s, s.rainCoverKey, '_showRainCover', v);
    },
    getShowAltitudeBorders(): boolean {
      return s._showAltitudeBorders;
    },
    setShowAltitudeBorders(v: boolean): void {
      persistBool(s, s.altitudeBordersKey, '_showAltitudeBorders', v);
    },
    getAnimationsEnabled(): boolean {
      return s._animationsEnabled;
    },
    setAnimationsEnabled(v: boolean): void {
      persistBool(
        s,
        s.animationsEnabledKey,
        '_animationsEnabled',
        effectiveAnimationsEnabled(v),
      );
    },
    getShowGhostPosition(): boolean {
      return s._showGhostPosition;
    },
    setShowGhostPosition(v: boolean): void {
      persistBool(s, s.showGhostPositionKey, '_showGhostPosition', v);
    },
    getBrightnessAutoMode(): boolean {
      return s._brightnessAutoMode;
    },
    setBrightnessAutoMode(v: boolean): void {
      persistBool(s, s.brightnessAutoModeKey, '_brightnessAutoMode', v);
    },
    getShowWindowView(): boolean {
      return s._showWindowView;
    },
    setShowWindowView(v: boolean): void {
      persistBool(s, s.windowViewKey, '_showWindowView', v);
    },
  };
}

export type SettingsOverlayAccessors = ReturnType<
  typeof bindSettingsOverlayAccessors
>;
