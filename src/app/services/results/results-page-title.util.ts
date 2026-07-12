import type { CountryService } from '../country/country.service';
import type { PlaneLogEntry } from '../../types/plane-log-entry';

const BASE_TITLE = 'Plane Alert';
const EMPTY_TITLE = 'Nothing peepworthy. - Plane Alert';

export function getTopPriorityPlane(
  sky: PlaneLogEntry[],
  airport: PlaneLogEntry[]
): PlaneLogEntry | undefined {
  const all = [...sky, ...airport];
  if (all.length === 0) return undefined;
  const military = all.find((p) => p.isMilitary);
  if (military) return military;
  const special = all.find((p) => p.isSpecial);
  if (special) return special;
  const withModel = all.find((p) => p.model);
  if (withModel) return withModel;
  return all[0];
}

export function updateResultsPageTitle(
  countryService: CountryService,
  topPlane: PlaneLogEntry | undefined,
  lastHash: string
): { hash: string; title: string } {
  if (!topPlane) {
    if (lastHash === '') return { hash: '', title: EMPTY_TITLE };
    return { hash: '', title: EMPTY_TITLE };
  }
  if (topPlane.isMilitary) {
    const code =
      countryService.getCountryCode(topPlane.origin)?.toUpperCase() ||
      topPlane.origin;
    const callsignPrefix = topPlane.callsign
      ? topPlane.callsign.substring(0, 3).toUpperCase()
      : 'N/A';
    const display =
      topPlane.model?.trim() || '' ? topPlane.model! : topPlane.callsign;
    const content = `[MIL] [${code}/${callsignPrefix}] ${display}`;
    return { hash: content, title: `${content} peeped! | ${BASE_TITLE}` };
  }
  if (topPlane.isSpecial) {
    const code =
      countryService.getCountryCode(topPlane.origin)?.toUpperCase() ||
      topPlane.origin;
    const callsignPrefix = topPlane.callsign
      ? topPlane.callsign.substring(0, 3).toUpperCase()
      : 'N/A';
    const displayModel = topPlane.model?.trim() || topPlane.callsign;
    const specialTitle = `[${code}/${callsignPrefix}] ${displayModel} peeped!`;
    return { hash: specialTitle, title: `${specialTitle} | ${BASE_TITLE}` };
  }
  let display = '';
  if (topPlane.operator) display = topPlane.operator;
  else if (topPlane.callsign && topPlane.callsign.trim().length >= 3)
    display = topPlane.callsign;
  else if (topPlane.model) display = topPlane.model;
  if (!display) return { hash: lastHash, title: document.title };
  return { hash: display, title: `Just stinky ${display}. | ${BASE_TITLE}` };
}

export function resetPageTitle(): void {
  document.title = BASE_TITLE;
}
