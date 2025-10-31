import { Injectable } from '@angular/core';
import { PlaneModel, PositionHistory } from '../models/plane-model';
import { Plane } from '../types/plane';
import { NewPlaneService } from '../services/new-plane.service';
import { HelicopterListService } from './helicopter-list.service';
import { SpecialListService } from './special-list.service';
import { UnknownListService } from './unknown-list.service';
import { OperatorCallSignService } from './operator-call-sign.service';
import { MilitaryPrefixService } from './military-prefix.service';
import { HelicopterIdentificationService } from './helicopter-identification.service';
import { AircraftCountryService } from '../services/aircraft-country.service';
import {
  AircraftDbService,
  AircraftRecord,
} from '../services/aircraft-db.service';
import { filterPlaneByPrefix } from '../utils/plane-log';

export interface ProcessedPlaneData {
  id: string;
  callsign: string;
  registration: string;
  origin: string;
  lat: number;
  lon: number;
  track: number | null;
  velocity: number | null;
  altitude: number;
  onGround: boolean;
  isMilitary: boolean;
  isSpecial: boolean;
  isUnknown: boolean;
  model: string;
  operator: string;
  isNew: boolean;
  isFiltered: boolean;
  verticalRate: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class PlaneDataService {
  // Track logged unknown countries to prevent duplicates
  private loggedUnknownCountries = new Set<string>();
  private unknownCountryAircraft: Array<{
    icao: string;
    registration: string;
    operator: string;
    rawCountry: string;
    callsign: string;
    detectedCountry: string;
    isMilitary: boolean;
  }> = [];
  private lastUnknownCountryLogTime = 0;

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

  async fetchPlaneData(
    centerLat: number,
    centerLon: number,
    radiusKm: number
  ): Promise<any[]> {
    try {
      const radiusNm = radiusKm / 1.852;
      const url = `https://api.adsb.one/v2/point/${centerLat}/${centerLon}/${radiusNm}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.warn(
          `ADS-B One API error ${response.status}: ${response.statusText}. Using cached data.`
        );
        throw new Error(`ADSB One API fetch error ${response.status}`);
      }

      const data = await response.json();
      return data.ac || [];
    } catch (err) {
      console.warn('ADS-B API unavailable, using cached aircraft data:', err);
      return [];
    }
  }

  processAircraftData(
    ac: any,
    centerLat: number,
    centerLon: number,
    radiusKm: number,
    excludeDiscount: boolean,
    blockedPrefixes: string[],
    isInitialLoad: boolean,
    getAircraftInfo: (
      icao: string
    ) => { model?: string; ownop?: string; mil?: boolean } | null
  ): ProcessedPlaneData | null {
    const id = ac.hex.toUpperCase();

    // API changed: 'callsign' field is now 'flight'
    const rawCallsign = ac.flight?.trim() || ac.callsign?.trim() || '';
    const callsign = /^@+$/.test(rawCallsign) ? '' : rawCallsign;

    // Use ADSB One 'r' property for registration
    const reg: string = ac.r?.trim() || '';

    // Extract aircraft model/type from ADS-B One API
    const apiModel = ac.desc?.trim() || '';
    const apiIcaoType = ac.t?.trim() || '';

    // Fetch DB record
    const dbAircraft = getAircraftInfo(id);

    // Determine military status early (needed for country detection priority)
    const prefixIsMil = this.militaryPrefixService.isMilitaryCallsign(callsign);
    const isMilitary = prefixIsMil || dbAircraft?.mil || false;

    // Derive country using the aircraft country service
    const rawCountry = ac.ctry ?? ac.countryCode;
    const origin = this.aircraftCountryService.getAircraftCountry(
      reg,
      id,
      rawCountry,
      isMilitary
    );

    const lat = ac.lat;
    const lon = ac.lon;
    const track = ac.track;
    const velocity = ac.gs;

    // Process altitude
    const altitudeApiValue = ac.alt_baro ?? ac.alt_geom;
    const altitudeFeet = altitudeApiValue ?? 0;
    const altitude = altitudeFeet * 0.3048;

    // Determine if on ground
    let onGroundBasedOnLogic = false;
    let altitudeForHeuristicCheck: number | undefined;

    if (ac.alt_baro === 'ground') {
      altitudeForHeuristicCheck = 0;
    } else if (typeof ac.alt_baro === 'number') {
      altitudeForHeuristicCheck = ac.alt_baro;
    } else if (typeof ac.alt_geom === 'number') {
      altitudeForHeuristicCheck = ac.alt_geom;
    }

    if (
      typeof altitudeForHeuristicCheck === 'number' &&
      altitudeForHeuristicCheck < 150 &&
      typeof velocity === 'number' &&
      velocity < 50
    ) {
      onGroundBasedOnLogic = true;
    }
    const onGround = ac.ground === true || onGroundBasedOnLogic;

    const isSpecial = this.specialListService.isSpecial(id);
    const isUnknown = this.unknownListService.isUnknown(id);

    // Check if plane should be filtered
    const wouldBeFiltered = filterPlaneByPrefix(
      callsign,
      excludeDiscount,
      blockedPrefixes
    );
    const isFiltered = isInitialLoad
      ? false
      : isMilitary
      ? false
      : wouldBeFiltered;

    // Check distance from center
    const dist = this.calculateDistance(centerLat, centerLon, lat, lon);
    if (dist > radiusKm) {
      return null; // Out of range
    }

    const isNew = this.newPlaneService.isNew(id);

    // Determine operator and model
    const prefixOperator =
      this.operatorCallSignService.getOperatorWithLogging(callsign);
    let operator = prefixOperator ?? (dbAircraft?.ownop || '');
    let model = apiModel || dbAircraft?.model || '';

    if (
      !model &&
      this.helicopterIdentificationService.isHelicopter(id, model, operator)
    ) {
      model = 'Helicopter';
    }

    // Add unknown aircraft to database
    if (!dbAircraft) {
      let dbModel = apiModel || '';
      if (
        !dbModel &&
        this.helicopterIdentificationService.isHelicopter(id, dbModel, operator)
      ) {
        dbModel = 'Helicopter';
      }
      const aircraftRecord: AircraftRecord = {
        icao: id,
        reg: reg || id,
        icaotype: apiIcaoType || '',
        year: '',
        manufacturer: '',
        model: dbModel,
        ownop: operator || '',
        faa_pia: false,
        faa_ladd: false,
        short_type: dbModel,
        mil: isMilitary,
      };
      this.aircraftDb.addRecord(aircraftRecord);
    }

    // Log unknown countries
    this.logUnknownCountries(
      id,
      reg,
      operator,
      rawCountry,
      callsign,
      origin,
      isMilitary
    );

    return {
      id,
      callsign,
      registration: reg,
      origin,
      lat,
      lon,
      track,
      velocity,
      altitude,
      onGround,
      isMilitary,
      isSpecial,
      isUnknown,
      model,
      operator,
      isNew,
      isFiltered,
      verticalRate: ac.baro_rate ?? null,
    };
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private logUnknownCountries(
    icao: string,
    registration: string,
    operator: string,
    rawCountry: string,
    callsign: string,
    detectedCountry: string,
    isMilitary: boolean
  ): void {
    if (
      (detectedCountry === 'Unknown' ||
        (isMilitary && detectedCountry !== 'Unknown')) &&
      !this.loggedUnknownCountries.has(icao)
    ) {
      this.unknownCountryAircraft.push({
        icao,
        registration: registration || 'N/A',
        operator: operator || 'N/A',
        rawCountry: rawCountry || 'N/A',
        callsign: callsign || 'N/A',
        detectedCountry,
        isMilitary,
      });
      this.loggedUnknownCountries.add(icao);
    }

    // Log batch every 30 seconds
    const now = Date.now();
    if (
      now - this.lastUnknownCountryLogTime > 30000 &&
      this.unknownCountryAircraft.length > 0
    ) {
      this.unknownCountryAircraft.forEach((aircraft) => {
        const milFlag = aircraft.isMilitary ? '[MIL]' : '';
        console.log(`Unknown country aircraft ${milFlag}:`, aircraft);
      });
      this.unknownCountryAircraft = [];
      this.lastUnknownCountryLogTime = now;
    }
  }

  createOrUpdatePlaneModel(
    processedData: ProcessedPlaneData,
    previousLog: Map<string, PlaneModel>,
    centerLat: number,
    centerLon: number
  ): { planeModel: PlaneModel; isExisting: boolean } {
    const {
      id,
      callsign,
      origin,
      lat,
      lon,
      track,
      velocity,
      altitude,
      onGround,
      isNew,
      isFiltered,
      isSpecial,
      isMilitary,
      isUnknown,
    } = processedData;

    let planeModelInstance = previousLog.get(id);
    const isExistingPlane = !!planeModelInstance;

    if (!planeModelInstance) {
      const firstSeen = Date.now();
      const initialPlaneData: Plane = {
        icao: id,
        callsign: callsign,
        origin: origin,
        firstSeen: firstSeen,
        model: processedData.model,
        operator: processedData.operator,
        bearing: 0,
        cardinal: '',
        arrow: '',
        isNew: isNew,
        lat: lat,
        lon: lon,
        marker: undefined,
        path: undefined,
        filteredOut: isFiltered,
        onGround: onGround,
        track: track,
        velocity: velocity,
        isSpecial: isSpecial,
      };
      planeModelInstance = new PlaneModel(initialPlaneData);
      planeModelInstance.isMilitary = isMilitary;
      previousLog.set(id, planeModelInstance);
    } else {
      // Update existing plane
      planeModelInstance.callsign = callsign;
      planeModelInstance.origin = origin;
      planeModelInstance.lat = lat;
      planeModelInstance.lon = lon;
      planeModelInstance.filteredOut = isFiltered;
      planeModelInstance.onGround = onGround;
      planeModelInstance.isNew = isNew;
      planeModelInstance.isSpecial = isSpecial;
      planeModelInstance.isMilitary = isMilitary;
      planeModelInstance.isUnknown = isUnknown;
    }

    // Update model properties
    planeModelInstance.model = processedData.model;
    planeModelInstance.operator = processedData.operator;

    // Calculate derived properties
    const bearing = this.computeBearing(centerLat, centerLon, lat, lon);
    const cardinal = this.getCardinalDirection(bearing);
    const arrow = this.getArrowForDirection(cardinal);

    planeModelInstance.bearing = bearing;
    planeModelInstance.cardinal = cardinal;
    planeModelInstance.arrow = arrow;
    planeModelInstance.altitude = altitude;
    planeModelInstance.verticalRate = processedData.verticalRate;

    // Add position to history for existing planes
    if (isExistingPlane && typeof lat === 'number' && typeof lon === 'number') {
      planeModelInstance.addPositionToHistory(
        lat,
        lon,
        track,
        velocity,
        altitude
      );
    }

    return { planeModel: planeModelInstance, isExisting: isExistingPlane };
  }

  private computeBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
  }

  private getCardinalDirection(bearing: number): string {
    const directions = [
      'N',
      'NNE',
      'NE',
      'ENE',
      'E',
      'ESE',
      'SE',
      'SSE',
      'S',
      'SSW',
      'SW',
      'WSW',
      'W',
      'WNW',
      'NW',
      'NNW',
    ];
    const index = Math.round(bearing / 22.5) % 16;
    return directions[index];
  }

  private getArrowForDirection(cardinal: string): string {
    const arrows: { [key: string]: string } = {
      N: '↑',
      NNE: '↗',
      NE: '↗',
      ENE: '↗',
      E: '→',
      ESE: '↘',
      SE: '↘',
      SSE: '↘',
      S: '↓',
      SSW: '↙',
      SW: '↙',
      WSW: '↙',
      W: '←',
      WNW: '↖',
      NW: '↖',
      NNW: '↖',
    };
    return arrows[cardinal] || '↑';
  }
}
