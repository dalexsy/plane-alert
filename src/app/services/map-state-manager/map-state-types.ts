export interface ViewState {
  center: { lat: number; lon: number };
  zoom: number;
  bounds?: { north: number; south: number; east: number; west: number };
}

export interface UIToggles {
  showDateTime: boolean;
  showCloudCover: boolean;
  showRainCover: boolean;
  showViewAxes: boolean;
  showAirportLabels: boolean;
  showAltitudeBorders: boolean;
  coneVisible: boolean;
  cloudVisible: boolean;
  rainVisible: boolean;
}

export interface OverlayStates {
  inputOverlayCollapsed: boolean;
  seenCollapsed: boolean;
  resultsVisible: boolean;
  locationOverlayVisible: boolean;
  windowViewVisible: boolean;
  isResizing: boolean;
  loadingAirports: boolean;
}

export interface FollowState {
  mode: 'none' | 'manual' | 'nearest' | 'shuffle';
  followedPlaneIcao: string | null;
  followNearest: boolean;
  trackingActive: boolean;
}

export interface EnvironmentalSettings {
  cloudOpacity: number;
  rainOpacity: number;
  brightness: number;
  windUnitIndex: number;
}

export interface MapState {
  view: ViewState;
  uiToggles: UIToggles;
  overlayStates: OverlayStates;
  followState: FollowState;
  environmentalSettings: EnvironmentalSettings;
  homeLocation: { lat: number; lon: number } | null;
  radius: number;
  lastUpdate: number;
}

export const initialMapState: MapState = {
  view: { center: { lat: 40.7128, lon: -74.006 }, zoom: 10 },
  uiToggles: {
    showDateTime: true, showCloudCover: true, showRainCover: true, showViewAxes: false,
    showAirportLabels: true, showAltitudeBorders: true, coneVisible: false, cloudVisible: true, rainVisible: true,
  },
  overlayStates: {
    inputOverlayCollapsed: false, seenCollapsed: false, resultsVisible: true,
    locationOverlayVisible: true, windowViewVisible: true, isResizing: false, loadingAirports: false,
  },
  followState: { mode: 'none', followedPlaneIcao: null, followNearest: false, trackingActive: false },
  environmentalSettings: { cloudOpacity: 1.0, rainOpacity: 0.8, brightness: 1.0, windUnitIndex: 0 },
  homeLocation: null,
  radius: 5,
  lastUpdate: Date.now(),
};

export function loadUITogglesFromStorage(): Partial<UIToggles> {
  const toggles: Partial<UIToggles> = {};
  for (const setting of ['showDateTime', 'showCloudCover', 'showRainCover', 'showViewAxes', 'showAirportLabels', 'showAltitudeBorders']) {
    const value = localStorage.getItem(setting);
    if (value !== null) (toggles as any)[setting] = value === 'true';
  }
  return toggles;
}

export function loadEnvironmentalSettingsFromStorage(): Partial<EnvironmentalSettings> {
  const settings: Partial<EnvironmentalSettings> = {};
  const windUnitIndex = localStorage.getItem('windUnitIndex');
  if (windUnitIndex !== null) settings.windUnitIndex = parseInt(windUnitIndex, 10);
  return settings;
}

export function loadPersistedMapState(): Partial<MapState> {
  try {
    const homeLocationStr = localStorage.getItem('homeLocation');
    const homeLocation = homeLocationStr ? JSON.parse(homeLocationStr) : null;
    const radiusStr = localStorage.getItem('radius');
    const radius = radiusStr ? parseFloat(radiusStr) : initialMapState.radius;
    const latStr = localStorage.getItem('lat');
    const lonStr = localStorage.getItem('lon');
    const view =
      latStr && lonStr
        ? { ...initialMapState.view, center: { lat: parseFloat(latStr), lon: parseFloat(lonStr) } }
        : initialMapState.view;
    return {
      view,
      uiToggles: { ...initialMapState.uiToggles, ...loadUITogglesFromStorage() },
      environmentalSettings: { ...initialMapState.environmentalSettings, ...loadEnvironmentalSettingsFromStorage() },
      homeLocation,
      radius,
    };
  } catch (error) {
    console.warn('Failed to load state from storage:', error);
    return {};
  }
}

export function saveUITogglesToStorage(updates: Partial<UIToggles>): void {
  Object.entries(updates).forEach(([key, value]) => localStorage.setItem(key, value.toString()));
}

export function saveEnvironmentalSettingsToStorage(updates: Partial<EnvironmentalSettings>): void {
  Object.entries(updates).forEach(([key, value]) => localStorage.setItem(key, value.toString()));
}

export function clearMapStateStorage(): void {
  for (const key of ['lat', 'lon', 'radius', 'homeLocation', 'showDateTime', 'showCloudCover', 'showRainCover', 'showViewAxes', 'showAirportLabels', 'showAltitudeBorders', 'windUnitIndex']) {
    localStorage.removeItem(key);
  }
}
