import { Injectable } from '@angular/core';
import { PlaneModel } from '../../models/plane-model';
import { Plane } from '../../types/plane';
import { NewPlaneService } from '../new-plane/new-plane.service';
import { HelicopterListService } from '../helicopter-list/helicopter-list.service';
import { SpecialListService } from '../special-list/special-list.service';
import { UnknownListService } from '../unknown-list/unknown-list.service';
import { OperatorCallSignService } from '../operator-call-sign/operator-call-sign.service';
import { MilitaryPrefixService } from '../military-prefix/military-prefix.service';
import { HelicopterIdentificationService } from '../helicopter-identification/helicopter-identification.service';
import { AircraftCountryService } from '../aircraft-country/aircraft-country.service';
import { AircraftDbService, AircraftRecord } from '../aircraft-db/aircraft-db.service';
import { filterPlaneByPrefix } from '../../utils/plane-log/plane-log';
import { fetchPlaneDataFromApi } from './fetch-plane-data';
import {
  UnknownCountryLogger,
  bearingToCardinal,
  cardinalToArrow,
  computeBearingDegrees,
  haversineDistanceKm,
} from './plane-data-geo.util';

export interface ProcessedPlaneData {
  id: string;
  callsign: string;
  registration: string;
  origin: string;
  lat: number;
  lon: number;
  track: number | null;
  velocity: number | null;
  altitude: number | null;
  onGround: boolean;
  isMilitary: boolean;
  isSpecial: boolean;
  isA380: boolean;
  isUnknown: boolean;
  model: string;
  /** ADS-B ICAO type designator (`ac.t`), e.g. C30J. */
  icaoType?: string;
  /** ADS-B emitter category (`ac.category`), e.g. B2 lighter-than-air. */
  category?: string;
  operator: string;
  isNew: boolean;
  isFiltered: boolean;
  verticalRate: number | null;
  distanceKm: number;
}

@Injectable({ providedIn: 'root' })
export class PlaneDataService {
  private unknownLogger = new UnknownCountryLogger();

  constructor(
    private newPlaneService: NewPlaneService,
    private helicopterListService: HelicopterListService,
    private specialListService: SpecialListService,
    private unknownListService: UnknownListService,
    private operatorCallSignService: OperatorCallSignService,
    private militaryPrefixService: MilitaryPrefixService,
    private helicopterIdentificationService: HelicopterIdentificationService,
    private aircraftCountryService: AircraftCountryService,
    private aircraftDb: AircraftDbService
  ) {}

  async refreshLists(manualUpdate: boolean): Promise<void> {
    await this.helicopterListService.refreshHelicopterList(manualUpdate);
    await this.unknownListService.refreshUnknownList(manualUpdate);
    await this.specialListService.refreshSpecialList(manualUpdate);
    await this.militaryPrefixService.loadPrefixes();
  }

  async fetchPlaneData(centerLat: number, centerLon: number, radiusKm: number): Promise<any[]> {
    return fetchPlaneDataFromApi(centerLat, centerLon, radiusKm);
  }

  processAircraftData(
    ac: any,
    centerLat: number,
    centerLon: number,
    radiusKm: number,
    excludeDiscount: boolean,
    blockedPrefixes: string[],
    isInitialLoad: boolean,
    getAircraftInfo: (icao: string) => { model?: string; ownop?: string; mil?: boolean } | null
  ): ProcessedPlaneData | null {
    const id = ac.hex.toUpperCase();
    const rawCallsign = ac.flight?.trim() || ac.callsign?.trim() || '';
    const callsign = /^@+$/.test(rawCallsign) ? '' : rawCallsign;
    const reg: string = ac.r?.trim() || '';
    const apiModel = ac.desc?.trim() || '';
    const apiIcaoType = ac.t?.trim() || '';
    const apiCategory = typeof ac.category === 'string' ? ac.category.trim() : '';
    const dbAircraft = getAircraftInfo(id);
    const prefixIsMil = this.militaryPrefixService.isMilitaryCallsign(callsign);
    // Single military picture: ADS-B Exchange mil/dbFlags OR local DB mil OR callsign prefix.
    const adsBMil = ac.mil === true || Number(ac.dbFlags) === 1;
    const isMilitary = prefixIsMil || !!dbAircraft?.mil || adsBMil;
    const rawCountry = ac.ctry ?? ac.countryCode;
    const origin = this.aircraftCountryService.getAircraftCountry(reg, id, rawCountry, isMilitary);
    const lat = ac.lat;
    const lon = ac.lon;
    const track = ac.track;
    const velocityKnots = ac.gs;
    const velocity = velocityKnots != null ? velocityKnots * 0.514444 : null;
    const altitudeApiValue = ac.alt_baro ?? ac.alt_geom;
    let altitude: number | null = null;
    if (typeof altitudeApiValue === 'number') altitude = altitudeApiValue * 0.3048;
    else if (altitudeApiValue === 'ground') altitude = 0;
    let onGroundBasedOnLogic = false;
    let altitudeForHeuristicCheck: number | undefined;
    if (ac.alt_baro === 'ground') altitudeForHeuristicCheck = 0;
    else if (typeof ac.alt_baro === 'number') altitudeForHeuristicCheck = ac.alt_baro;
    else if (typeof ac.alt_geom === 'number') altitudeForHeuristicCheck = ac.alt_geom;
    if (typeof altitudeForHeuristicCheck === 'number' && altitudeForHeuristicCheck < 150 && typeof velocity === 'number' && velocity < 50) {
      onGroundBasedOnLogic = true;
    }
    const onGround = ac.ground === true || onGroundBasedOnLogic;
    const isUnknown = this.unknownListService.isUnknown(id);
    const wouldBeFiltered = filterPlaneByPrefix(callsign, excludeDiscount, blockedPrefixes);
    const isFiltered = isInitialLoad ? false : isMilitary ? false : wouldBeFiltered;
    const dist = haversineDistanceKm(centerLat, centerLon, lat, lon);
    if (dist > radiusKm) return null;
    const isNew = this.newPlaneService.isNew(id);
    const prefixOperator = this.operatorCallSignService.getOperatorWithLogging(callsign);
    let operator = prefixOperator ?? (dbAircraft?.ownop || '');
    let model = apiModel || dbAircraft?.model || '';
    const asHeli = (m: string) =>
      this.helicopterIdentificationService.isHelicopter(id, m, operator, callsign, apiIcaoType);
    if (!model && asHeli(model)) model = 'Helicopter';
    const isSpecial = this.specialListService.isSpecial(id);
    const isA380 = model && /a\s*-?\s*380/i.test(model);
    if (!dbAircraft) {
      const dbModel = apiModel || (asHeli('') ? 'Helicopter' : '');
      this.aircraftDb.addRecord({
        icao: id, reg: reg || id, icaotype: apiIcaoType || '', year: '', manufacturer: '',
        model: dbModel, ownop: operator || '', faa_pia: false, faa_ladd: false,
        short_type: dbModel, mil: isMilitary,
      });
    }
    this.unknownLogger.track({
      icao: id, registration: reg || 'N/A', operator: operator || 'N/A', rawCountry: rawCountry || 'N/A',
      callsign: callsign || 'N/A', detectedCountry: origin, isMilitary,
    });
    return {
      id, callsign, registration: reg, origin, lat, lon, track, velocity, altitude, onGround, isMilitary,
      isSpecial, isA380, isUnknown, model, icaoType: apiIcaoType || undefined,
      category: apiCategory || undefined, operator, isNew, isFiltered,
      verticalRate: ac.baro_rate ?? null, distanceKm: dist,
    };
  }

  createOrUpdatePlaneModel(
    processedData: ProcessedPlaneData,
    previousLog: Map<string, PlaneModel>,
    centerLat: number,
    centerLon: number
  ): { planeModel: PlaneModel; isExisting: boolean } {
    const { id, callsign, origin, lat, lon, track, velocity, altitude, onGround, isNew, isFiltered, isSpecial, isA380, isMilitary, isUnknown } = processedData;
    let planeModelInstance = previousLog.get(id);
    const isExistingPlane = !!planeModelInstance;
    if (!planeModelInstance) {
      planeModelInstance = new PlaneModel({
        icao: id, callsign, origin, firstSeen: Date.now(), model: processedData.model, operator: processedData.operator,
        bearing: 0, cardinal: '', arrow: '', isNew, lat, lon, distanceKm: processedData.distanceKm,
        marker: undefined, path: undefined, filteredOut: isFiltered, onGround, track, velocity, isSpecial, isA380,
      });
      planeModelInstance.isMilitary = isMilitary;
      previousLog.set(id, planeModelInstance);
    } else {
      Object.assign(planeModelInstance, {
        callsign, origin, lat, lon, filteredOut: isFiltered, onGround, isNew, isSpecial, isA380, isMilitary, isUnknown,
      });
    }
    planeModelInstance.model = processedData.model;
    planeModelInstance.icaoType = processedData.icaoType;
    planeModelInstance.category = processedData.category;
    planeModelInstance.operator = processedData.operator;
    planeModelInstance.distanceKm = processedData.distanceKm;
    const bearing = computeBearingDegrees(centerLat, centerLon, lat, lon);
    const cardinal = bearingToCardinal(bearing);
    planeModelInstance.bearing = bearing;
    planeModelInstance.cardinal = cardinal;
    planeModelInstance.arrow = cardinalToArrow(cardinal);
    planeModelInstance.altitude = altitude;
    planeModelInstance.verticalRate = processedData.verticalRate;
    if (isExistingPlane && typeof lat === 'number' && typeof lon === 'number') {
      planeModelInstance.addPositionToHistory(lat, lon, track, velocity, altitude);
    }
    return { planeModel: planeModelInstance, isExisting: isExistingPlane };
  }

  updateNewPlaneService(currentUpdateSet: Set<string>): void {
    this.newPlaneService.updatePlanes(currentUpdateSet);
  }
}
