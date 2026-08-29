import {
  A400M_SVG,
  BALLOON_SVG,
  C130_SVG,
  C17_SVG,
  HELICOPTER_SVG,
  PlaneIconData,
  SINGLE_ENGINE_SVG,
  TWIN_ENGINE_SVG,
  TYPE_ICON_MAP,
} from '../plane-icon-paths/plane-icon-paths';
import { matchEngineModel } from '../plane-icon-engine-mappings/plane-icon-engine-mappings';
import { isBalloonAircraft } from '../balloon-identification/balloon-identification.util';

export type { EngineIconType, PlaneIconData } from '../plane-icon-paths/plane-icon-paths';

export interface PlaneIconIdentity {
  icaoType?: string;
  category?: string;
}

function isFiveLetterCallsign(callsign?: string): boolean {
  return /^[A-Z]{5}$/.test((callsign || '').trim().toUpperCase());
}

const CESSNA: PlaneIconData = { path: SINGLE_ENGINE_SVG, iconType: 'single_engine' };
const TWIN: PlaneIconData = { path: TWIN_ENGINE_SVG, iconType: 'twin_engine' };

export function getIconPathForModel(
  model: string,
  callsign?: string,
  altitude?: number,
  isHelicopter?: boolean,
  identity?: PlaneIconIdentity
): PlaneIconData {
  if (isHelicopter) {
    return { path: HELICOPTER_SVG, iconType: 'helicopter' };
  }
  const icaoType = (identity?.icaoType || '').trim();
  if (isBalloonAircraft({ model, icaoType, category: identity?.category, callsign })) {
    return { path: BALLOON_SVG, iconType: 'balloon' };
  }

  const typeKeys = [icaoType, model].map((s) => s.trim().toUpperCase()).filter(Boolean);
  for (const key of typeKeys) {
    if (TYPE_ICON_MAP[key]) return TYPE_ICON_MAP[key];
  }
  if (/c-?17|globemaster/i.test(model) || /c-?17/i.test(icaoType)) {
    return { path: C17_SVG, iconType: 'quad_engine' };
  }
  if (/c-?130/i.test(model) || /c-?130/i.test(icaoType)) {
    return { path: C130_SVG, iconType: 'quad_engine' };
  }

  const m = `${icaoType} ${model}`.toLowerCase();
  if (m.includes('a400m')) return { path: A400M_SVG, iconType: 'quad_engine' };
  if (m.includes('pa-46') || m.includes('malibu')) return CESSNA;
  if (m.includes('172') || m.includes('skyhawk')) return CESSNA;
  if (m.includes('ctls') || m.includes('ct ls')) return CESSNA;
  if (
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
    return CESSNA;
  }
  const mapped = matchEngineModel(m);
  if (mapped) return mapped;
  if (isFiveLetterCallsign(callsign)) return CESSNA;
  return TWIN;
}
