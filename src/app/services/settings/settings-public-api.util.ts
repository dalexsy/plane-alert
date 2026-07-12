import type { SettingsService } from './settings.service';
import type { bindSettingsOverlayAccessors } from './settings-overlay-accessors.util';
import type { bindSettingsLocationAccessors } from './settings-location-accessors.util';
import {
  getClickedAirports,
  setClickedAirports,
} from './settings-accessors.util';

type Overlay = ReturnType<typeof bindSettingsOverlayAccessors>;
type Location = ReturnType<typeof bindSettingsLocationAccessors>;

export function defineSettingsPublicApi(
  service: SettingsService,
  overlay: Overlay,
  location: Location,
  asState: () => Parameters<typeof getClickedAirports>[0],
): void {
  Object.defineProperties(service, {
    showDateTimeOverlay: { get: () => overlay.getShowDateTimeOverlay(), configurable: true },
    showDateTimeOverlayMobile: { get: () => overlay.getShowDateTimeOverlayMobile(), configurable: true },
    showWindDirection: { get: () => overlay.getShowWindDirection(), configurable: true },
    showSunDirection: { get: () => overlay.getShowSunDirection(), configurable: true },
    useAutoLocation: { get: () => overlay.getUseAutoLocation(), configurable: true },
    showViewAxes: { get: () => overlay.getShowViewAxes(), configurable: true },
    seenCollapsed: { get: () => overlay.getSeenCollapsed(), configurable: true },
    inputOverlayCollapsed: { get: () => overlay.getInputOverlayCollapsed(), configurable: true },
    inputOverlayControlsHidden: { get: () => overlay.getInputOverlayControlsHidden(), configurable: true },
    resultsOverlayCollapsed: { get: () => overlay.getResultsOverlayCollapsed(), configurable: true },
    resultsOverlayControlsHidden: { get: () => overlay.getResultsOverlayControlsHidden(), configurable: true },
    militaryMute: { get: () => overlay.getMilitaryMute(), configurable: true },
    lat: { get: () => location.getLat(), configurable: true },
    lon: { get: () => location.getLon(), configurable: true },
    radius: { get: () => location.getRadius(), configurable: true },
    interval: { get: () => location.getInterval(), set: (v: number) => location.setIntervalValue(v), configurable: true },
    excludeDiscount: { get: () => location.getExcludeDiscount(), set: (v: boolean) => location.setExcludeDiscountValue(v), configurable: true },
    mapLat: { get: () => location.getMapLat(), configurable: true },
    mapLon: { get: () => location.getMapLon(), configurable: true },
    mapZoom: { get: () => location.getMapZoom(), configurable: true },
    currentAddress: { get: () => location.getCurrentAddress(), configurable: true },
    showAirportLabels: { get: () => overlay.getShowAirportLabels(), configurable: true },
    showCloudCover: { get: () => overlay.getShowCloudCover(), configurable: true },
    showRainCover: { get: () => overlay.getShowRainCover(), configurable: true },
    showAltitudeBorders: { get: () => overlay.getShowAltitudeBorders(), configurable: true },
    animationsEnabled: { get: () => overlay.getAnimationsEnabled(), configurable: true },
    brightnessAutoMode: { get: () => overlay.getBrightnessAutoMode(), configurable: true },
    windUnitIndex: { get: () => location.getWindUnitIndex(), configurable: true },
    distanceUnit: { get: () => location.getDistanceUnit(), configurable: true },
    timeUnit: { get: () => location.getTimeUnit(), configurable: true },
    showWindowView: { get: () => overlay.getShowWindowView(), configurable: true },
    viewConesConfig: { get: () => location.getViewConesConfig(), configurable: true },
  });

  Object.assign(service, {
    setShowDateTimeOverlay: (v: boolean) => overlay.setShowDateTimeOverlay(v),
    setShowDateTimeOverlayMobile: (v: boolean) => overlay.setShowDateTimeOverlayMobile(v),
    getDateTimeOverlayVisibility: () => overlay.getDateTimeOverlayVisibility(),
    setShowWindDirection: (v: boolean) => overlay.setShowWindDirection(v),
    setShowSunDirection: (v: boolean) => overlay.setShowSunDirection(v),
    setUseAutoLocation: (v: boolean) => overlay.setUseAutoLocation(v),
    setShowViewAxes: (v: boolean) => overlay.setShowViewAxes(v),
    setSeenCollapsed: (v: boolean) => overlay.setSeenCollapsed(v),
    setInputOverlayCollapsed: (v: boolean) => overlay.setInputOverlayCollapsed(v),
    setInputOverlayControlsHidden: (v: boolean) => overlay.setInputOverlayControlsHidden(v),
    setResultsOverlayCollapsed: (v: boolean) => overlay.setResultsOverlayCollapsed(v),
    setResultsOverlayControlsHidden: (v: boolean) => overlay.setResultsOverlayControlsHidden(v),
    setMilitaryMute: (v: boolean) => overlay.setMilitaryMute(v),
    setLat: (value: number) => location.setLat(value),
    setLon: (value: number) => location.setLon(value),
    setLocationWithAddress: (lat: number, lon: number, address: string) =>
      location.setLocationWithAddress(lat, lon, address),
    setRadius: (value: number) => location.setRadiusValue(value),
    getIntervalInDisplayUnit: () => location.getIntervalInDisplayUnit(),
    setIntervalFromDisplayUnit: (value: number) => location.setIntervalFromDisplayUnit(value),
    getFormattedIntervalDisplay: () => location.getFormattedIntervalDisplay(),
    setExcludeDiscount: (value: boolean) => { service.excludeDiscount = value; },
    setMapLat: (value: number) => location.setMapLat(value),
    setMapLon: (value: number) => location.setMapLon(value),
    setMapZoom: (value: number) => location.setMapZoom(value),
    setCurrentAddress: (value: string | null) => location.setCurrentAddress(value),
    setHomeLocation: (lat: number, lon: number, address?: string) =>
      location.setHomeLocation(lat, lon, address),
    getHomeLocation: () => location.getHomeLocation(),
    setShowAirportLabels: (v: boolean) => overlay.setShowAirportLabels(v),
    setShowCloudCover: (v: boolean) => overlay.setShowCloudCover(v),
    setShowRainCover: (v: boolean) => overlay.setShowRainCover(v),
    setShowAltitudeBorders: (v: boolean) => overlay.setShowAltitudeBorders(v),
    setAnimationsEnabled: (v: boolean) => overlay.setAnimationsEnabled(v),
    setBrightnessAutoMode: (v: boolean) => overlay.setBrightnessAutoMode(v),
    setWindUnitIndex: (v: number) => location.setWindUnitIndex(v),
    getClickedAirports: () => getClickedAirports(asState()),
    setClickedAirports: (clicked: Set<number>) => setClickedAirports(clicked),
    setDistanceUnit: (value: string) => location.setDistanceUnit(value),
    setTimeUnit: (value: string) => location.setTimeUnit(value),
    setShowWindowView: (v: boolean) => overlay.setShowWindowView(v),
    setViewConesConfig: (config: Parameters<Location['setViewConesConfig']>[0]) =>
      location.setViewConesConfig(config),
  });
}
