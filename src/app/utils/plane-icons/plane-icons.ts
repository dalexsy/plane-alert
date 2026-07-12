import {
  A400M_SVG,
  C130_SVG,
  C17_SVG,
  HELICOPTER_SVG,
  PlaneIconData,
  SINGLE_ENGINE_SVG,
  TWIN_ENGINE_SVG,
  TYPE_ICON_MAP,
} from '../plane-icon-paths/plane-icon-paths';
import { matchEngineModel } from '../plane-icon-engine-mappings/plane-icon-engine-mappings';

export type { EngineIconType, PlaneIconData } from '../plane-icon-paths/plane-icon-paths';

export function getIconPathForModel(
  model: string,
  callsign?: string,
  altitude?: number,
  isHelicopter?: boolean
): PlaneIconData {
  if (isHelicopter) {
    return { path: HELICOPTER_SVG, iconType: 'helicopter' };
  }
  if (callsign && callsign.length === 5 && /^[A-Z]{5}$/.test(callsign)) {
    return { path: SINGLE_ENGINE_SVG, iconType: 'single_engine' };
  }

  let result: PlaneIconData | undefined;
  const typeCode = model.trim().toUpperCase();
  if (TYPE_ICON_MAP[typeCode]) {
    result = TYPE_ICON_MAP[typeCode];
  } else if (/c-?17|globemaster/i.test(model)) {
    result = { path: C17_SVG, iconType: 'quad_engine' };
  } else if (/c-?130/i.test(model)) {
    result = { path: C130_SVG, iconType: 'quad_engine' };
  } else {
    const m = model.toLowerCase();
    if (m.includes('a400m')) {
      result = { path: A400M_SVG, iconType: 'quad_engine' };
    } else if (m.includes('pa-46') || m.includes('malibu')) {
      result = { path: SINGLE_ENGINE_SVG, iconType: 'single_engine' };
    } else if (m.includes('172') || m.includes('skyhawk')) {
      result = { path: SINGLE_ENGINE_SVG, iconType: 'single_engine' };
    } else if (m.includes('ctls') || m.includes('ct ls')) {
      result = { path: SINGLE_ENGINE_SVG, iconType: 'single_engine' };
    } else if (
      m.includes('tr182') ||
      m.includes('turbo skylane') ||
      m.includes('p.2008') ||
      m.includes('p2008') ||
      m.includes('da-40') ||
      m.includes('da40') ||
      m.includes('sr-22t') ||
      m.includes('sr22t') ||
      m.includes('a.210') ||
      m.includes('a210') ||
      m.includes('a.211') ||
      m.includes('a211') ||
      m.includes('c-42') ||
      m.includes('c42') ||
      m.includes('katana') ||
      m.includes('p.2002') ||
      m.includes('p2002') ||
      m.includes('pc-12') ||
      m.includes('pc12')
    ) {
      result = { path: SINGLE_ENGINE_SVG, iconType: 'single_engine' };
    } else if (m.trim() === '') {
      result = { path: TWIN_ENGINE_SVG, iconType: 'twin_engine' };
    } else {
      result = matchEngineModel(m) ?? { path: TWIN_ENGINE_SVG, iconType: 'twin_engine' };
    }
  }

  return result!;
}
