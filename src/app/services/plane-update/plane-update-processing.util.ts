import * as L from 'leaflet';
import { PlaneModel } from '../../models/plane-model';
import {
  playAlertSound,
  playHerculesAlert,
  playA400Alert,
} from '../../utils/alert-sound/alert-sound';
import type { PlaneUpdateService } from './plane-update.service';

export function getFaviconUrlForPlanes(
  svc: PlaneUpdateService,
  updatedLog: PlaneModel[],
): string {
  const hasSpecial = updatedLog.some((p) =>
    svc['specialListService'].isSpecial(p.icao),
  );
  const hasMil = updatedLog.some(
    (p) => !!svc['aircraftDb'].lookup(p.icao)?.mil,
  );
  return hasSpecial
    ? 'assets/favicon/special/favicon.ico'
    : hasMil
      ? 'assets/favicon/military/favicon.ico'
      : 'assets/favicon/favicon.ico';
}

export function playAlertsForNewPlanes(
  svc: PlaneUpdateService,
  updatedLog: PlaneModel[],
  exclude: boolean,
): void {
  const newVisible = updatedLog.filter((p) => p.isNew && !p.filteredOut);
  const hasHercules = newVisible.some((p) =>
    p.model?.toLowerCase().includes('hercules'),
  );
  const hasA400 = newVisible.some((p) => p.model?.match(/a\s*-?\s*400/i));
  // Use plane.isMilitary (DB mil OR callsign prefix) — same gate as TTS on phones.
  // Kiosk has no TTS; DB-only checks left prefix-military silent on magicmirror.
  // A380 / luxury-liner alert removed — commercial A380s were firing with nothing mil/special.
  const hasAlertPlanes = newVisible.some(
    (p) => p.isMilitary || svc['specialListService'].isSpecial(p.icao),
  );
  const militaryPlanes = newVisible.filter((p) => p.isMilitary);

  if (!svc['settings'].militaryMute) {
    if (hasHercules) {
      playHerculesAlert();
    } else if (hasA400) {
      playA400Alert();
    } else if (hasAlertPlanes) {
      playAlertSound();
    }
  }

  militaryPlanes.forEach((plane) => {
    const record = svc['aircraftDb'].lookup(plane.icao);
    const modelLabel = plane.model?.trim() || record?.model || undefined;
    svc['notificationService'].showMilitaryPlaneNotification({
      icao: plane.icao,
      callsign: plane.callsign,
      model: modelLabel,
      operator: record?.ownop,
      altitude: plane.altitude || undefined,
      speed: plane.velocity || undefined,
      direction: plane.cardinal,
      distanceKm: plane.distanceKm,
      origin: plane.origin,
      verticalRate: plane.verticalRate || undefined,
    });
  });
}

export function processPlaneModels(
  svc: PlaneUpdateService,
  updatedLog: PlaneModel[],
  previousPlaneKeys: Set<string>,
  exclude: boolean,
): PlaneModel[] {
  const isPlaneModel = (p: unknown): p is PlaneModel =>
    !!p && typeof (p as PlaneModel).updateFrom === 'function';

  return updatedLog.map((p) => {
    const planeModel = isPlaneModel(p) ? p : new PlaneModel(p);
    planeModel.isNew = !previousPlaneKeys.has(planeModel.icao);

    const dbMil = svc['aircraftDb'].lookup(planeModel.icao)?.mil || false;
    const prefixMil = svc['militaryPrefixService'].isMilitaryCallsign(
      planeModel.callsign,
    );
    const isMilitary = dbMil || prefixMil;
    planeModel.isMilitary = isMilitary;

    planeModel.filteredOut = !svc['planeFilter'].shouldIncludeCallsign(
      planeModel.callsign,
      exclude,
      svc['planeFilter'].getFilterPrefixes(),
      isMilitary,
    );

    return planeModel;
  });
}

export function updatePlaneLogsAndVisuals(
  updatedPlaneModels: PlaneModel[],
  planeLog: Map<string, PlaneModel>,
  activePlaneIcaos: Set<string>,
  map: L.Map,
): void {
  for (const [id, plane] of planeLog.entries()) {
    if (!updatedPlaneModels.some((p) => p.icao === id)) {
      plane.removeVisuals(map);
      planeLog.delete(id);
    }
  }

  for (const planeModel of updatedPlaneModels) {
    planeLog.set(planeModel.icao, planeModel);
  }

  activePlaneIcaos.clear();
  for (const icao of planeLog.keys()) {
    activePlaneIcaos.add(icao);
  }
}

export function reapplyTooltipHighlight(
  highlightedPlaneIcao: string | null,
  planeLog: Map<string, PlaneModel>,
): void {
  if (highlightedPlaneIcao) {
    const pm = planeLog.get(highlightedPlaneIcao);
    const tooltipEl = pm?.marker?.getTooltip()?.getElement();
    tooltipEl?.classList.add('highlighted-tooltip');
  }
}
