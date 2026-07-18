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
  // Same gate as list military/special styling — never alert on model string alone
  // (commercial A380 / stray "hercules" in desc used to sound with nothing mil on list).
  const alertable = newVisible.filter(
    (p) => p.isMilitary || svc['specialListService'].isSpecial(p.icao),
  );
  const hasHercules = alertable.some((p) =>
    p.model?.toLowerCase().includes('hercules'),
  );
  const hasA400 = alertable.some((p) => p.model?.match(/a\s*-?\s*400/i));
  const hasAlertPlanes = alertable.length > 0;
  const militaryPlanes = newVisible.filter((p) => p.isMilitary);

  if (!svc['settings'].militaryMute && hasAlertPlanes) {
    const sample = alertable.slice(0, 5).map((p) => ({
      icao: p.icao,
      callsign: p.callsign,
      model: p.model,
      isMilitary: p.isMilitary,
    }));
    const reason = hasHercules
      ? 'hercules'
      : hasA400
        ? 'a400'
        : 'mil-or-special';
    console.info('[plane-alert] SPA MP3', { reason, count: alertable.length, sample });
    if (hasHercules) {
      playHerculesAlert();
    } else if (hasA400) {
      playA400Alert();
    } else {
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
    // Keep ADS-B mil/dbFlags already set in plane-data (do not wipe feed flags).
    const isMilitary = dbMil || prefixMil || planeModel.isMilitary === true;
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
