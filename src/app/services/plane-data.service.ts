import { Injectable } from '@angular/core';
import { PlaneModel, PositionHistory } from '../models/plane-model';
import { Plane } from '../types/plane';
import { NewPlaneService } from '../services/new-plane.service';
import { HelicopterListService } from './helicopter-list.service';
import { SpecialListService } from './special-list.service';
import { UnknownListService } from './unknown-list.service';
import { OperatorCallSignService } from './operator-call-sign.service';
import { HelicopterIdentificationService } from './helicopter-identification.service';
import { AircraftCountryService } from '../services/aircraft-country.service';
import { looksMilitary } from '@plane-alert/shared';
import {
  AircraftDbService,
  AircraftRecord,
} from '../services/aircraft-db.service';
import { filterPlaneByPrefix } from '../utils/plane-log';
import { AircraftSnapshotService } from './aircraft-snapshot.service';
import { OpenskyRouteService } from './opensky-route.service';

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
  operator: string;
  categoryCode: string | null;
  icaoType: string | null;
  typeDescription: string | null;
  isNew: boolean;
  isFiltered: boolean;
  verticalRate: number | null;
  distanceKm: number;
  routeOrigin?: string;
  routeDestination?: string;
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

  // Store route data for aircraft
  private routeDataCache = new Map<
    string,
    { origin?: string; destination?: string }
  >();

  constructor(
    private newPlaneService: NewPlaneService,
    private helicopterListService: HelicopterListService,
    private specialListService: SpecialListService,
    private unknownListService: UnknownListService,
    private operatorCallSignService: OperatorCallSignService,
    private helicopterIdentificationService: HelicopterIdentificationService,
    private aircraftCountryService: AircraftCountryService,
    private aircraftDb: AircraftDbService,
    private aircraftSnapshot: AircraftSnapshotService,
    private openskyRouteService: OpenskyRouteService
  ) {}

  async refreshLists(manualUpdate: boolean): Promise<void> {
    await this.helicopterListService.refreshHelicopterList(manualUpdate);
    await this.unknownListService.refreshUnknownList(manualUpdate);
    await this.specialListService.refreshSpecialList(manualUpdate);
  }

  /**
   * Fetch plane data from Firestore (realtime updates from backend)
   * Subscribes to location-based aircraft snapshots instead of hitting ADSB API directly
   */
  async fetchPlaneData(
    centerLat: number,
    centerLon: number,
    radiusKm: number
  ): Promise<any[]> {
    try {
      // Subscribe to Firestore realtime updates for this location
      // Wait for initial data to be loaded before returning
      await this.aircraftSnapshot.subscribeToLocation(
        centerLat,
        centerLon,
        radiusKm
      );

      // Return current cached data (now populated with initial fetch)
      const aircraft = this.aircraftSnapshot.getCurrentAircraft();

      console.log('Fetched aircraft data from Firestore', {
        location: `${centerLat.toFixed(2)},${centerLon.toFixed(2)}`,
        radiusKm,
        count: aircraft.length,
        lastUpdate: new Date(
          this.aircraftSnapshot.getLastUpdate()
        ).toLocaleTimeString(),
      });

      return aircraft;
    } catch (err) {
      console.warn('Firestore aircraft data unavailable:', err);
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
    const rawCategory =
      ac.category !== undefined && ac.category !== null
        ? String(ac.category).trim()
        : '';
    const categoryCode = rawCategory ? rawCategory.toUpperCase() : null;
    const rawTypeDescription =
      ac.type !== undefined && ac.type !== null ? String(ac.type).trim() : '';
    const typeDescription = rawTypeDescription || null;

    // Fetch DB record
    const dbAircraft = getAircraftInfo(id);

    // Determine military status using shared looksMilitary() function (same logic as backend)
    // This checks: mil flag OR dbFlags AND filters boring aircraft types
    const isMilitary = looksMilitary(ac);

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
    const velocityKnots = ac.gs;
    // Convert knots to m/s for internal use (1 knot = 0.514444 m/s)
    const velocity =
      velocityKnots !== undefined && velocityKnots !== null
        ? velocityKnots * 0.514444
        : null;

    // Process altitude (API returns feet, convert to meters for internal storage)
    // Note: alt_baro can be 'ground' string or a number in feet
    const altitudeApiValue = ac.alt_baro ?? ac.alt_geom;
    let altitude: number | null = null;

    if (typeof altitudeApiValue === 'number') {
      // Convert feet to meters (1 foot = 0.3048 meters)
      altitude = altitudeApiValue * 0.3048;
    } else if (altitudeApiValue === 'ground') {
      altitude = 0;
    }

    // For the heuristic check, use the original feet value
    const altitudeFeet =
      typeof altitudeApiValue === 'number' ? altitudeApiValue : 0;

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
      this.helicopterIdentificationService.isHelicopter(
        id,
        model,
        operator,
        categoryCode,
        apiIcaoType,
        callsign
      )
    ) {
      model = 'Helicopter';
    }

    const isSpecial = this.specialListService.isSpecial(id);

    // Check if this is an A380 for visual highlighting
    const isA380 = model && /a\s*-?\s*380/i.test(model);

    // Add unknown aircraft to database
    if (!dbAircraft) {
      let dbModel = apiModel || '';
      if (
        !dbModel &&
        this.helicopterIdentificationService.isHelicopter(
          id,
          dbModel,
          operator,
          categoryCode,
          apiIcaoType,
          callsign
        )
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

    // Fetch route data asynchronously (non-blocking)
    // This will use cached data if available
    this.openskyRouteService.getFlightRoute(id).subscribe((route) => {
      if (route && (route.origin || route.destination)) {
        this.routeDataCache.set(id, {
          origin: route.origin,
          destination: route.destination,
        });
      }
    });

    // Get cached route data if available
    const cachedRoute = this.routeDataCache.get(id);

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
      isA380,
      isUnknown,
      model,
      operator,
      isNew,
      categoryCode,
      icaoType: apiIcaoType || null,
      typeDescription,
      isFiltered,
      verticalRate: ac.baro_rate ?? null,
      distanceKm: dist,
      routeOrigin: cachedRoute?.origin,
      routeDestination: cachedRoute?.destination,
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
    centerLon: number,
    snapshotTimestamp?: number
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
      isA380,
      isMilitary,
      isUnknown,
    } = processedData;

    let planeModelInstance = previousLog.get(id);
    const isExistingPlane = !!planeModelInstance;

    const backendHistory = this.aircraftSnapshot.getCurrentHistory();
    const planeHistory = backendHistory[id];

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
        distanceKm: processedData.distanceKm,
        marker: undefined,
        path: undefined,
        filteredOut: isFiltered,
        onGround: onGround,
        track: track,
        velocity: velocity,
        isSpecial: isSpecial,
        isA380: isA380,
      };
      planeModelInstance = new PlaneModel(initialPlaneData);
      planeModelInstance.isMilitary = isMilitary;
      planeModelInstance.isUnknown = isUnknown;

      // Seed position history from backend if available
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
      planeModelInstance.isA380 = isA380;
      planeModelInstance.isMilitary = isMilitary;
      planeModelInstance.isUnknown = isUnknown;
    }

    this.syncPositionHistory(
      planeModelInstance,
      planeHistory,
      processedData,
      snapshotTimestamp,
      isExistingPlane
    );

    // Update model properties
    planeModelInstance.model = processedData.model;
    planeModelInstance.operator = processedData.operator;
    planeModelInstance.distanceKm = processedData.distanceKm;
    planeModelInstance.categoryCode = processedData.categoryCode ?? undefined;
    planeModelInstance.icaoType = processedData.icaoType ?? undefined;
    planeModelInstance.typeDescription =
      processedData.typeDescription ?? undefined;
    planeModelInstance.routeOrigin = processedData.routeOrigin;
    planeModelInstance.routeDestination = processedData.routeDestination;

    // Calculate derived properties
    const bearing = this.computeBearing(centerLat, centerLon, lat, lon);
    const cardinal = this.getCardinalDirection(bearing);
    const arrow = this.getArrowForDirection(cardinal);

    planeModelInstance.bearing = bearing;
    planeModelInstance.cardinal = cardinal;
    planeModelInstance.arrow = arrow;
    planeModelInstance.altitude = altitude;
    planeModelInstance.verticalRate = processedData.verticalRate;

    return { planeModel: planeModelInstance, isExisting: isExistingPlane };
  }

  private syncPositionHistory(
    planeModel: PlaneModel,
    planeHistory:
      | Array<{ lat: number; lon: number; timestamp: number }>
      | undefined,
    processedData: ProcessedPlaneData,
    snapshotTimestamp: number | undefined,
    isExistingPlane: boolean
  ): void {
    const validHistory = Array.isArray(planeHistory)
      ? planeHistory.filter(
          (entry) =>
            entry &&
            typeof entry.lat === 'number' &&
            typeof entry.lon === 'number' &&
            typeof entry.timestamp === 'number'
        )
      : [];

    if (validHistory.length > 0) {
      const previousHistory = Array.isArray(planeModel.positionHistory)
        ? [...planeModel.positionHistory]
        : [];
      const previousMap = new Map<number, PositionHistory>();
      previousHistory.forEach((entry) => {
        if (typeof entry?.timestamp === 'number') {
          previousMap.set(entry.timestamp, entry);
        }
      });

      planeModel.positionHistory = [];
      let lastKnownAltitude =
        typeof processedData.altitude === 'number'
          ? processedData.altitude
          : null;
      const altitudeValues: number[] = [];
      const fallbackStats = {
        restored: 0,
        fromPrevious: 0,
        fromCurrent: 0,
        missing: 0,
      };

      validHistory.forEach((entry, index) => {
        const isLatest = index === validHistory.length - 1;
        const existing = previousMap.get(entry.timestamp);

        let altitudeSource: 'existing' | 'previous' | 'current' | 'missing' =
          'missing';
        let altitude: number | null | undefined = existing?.altitude;
        if (typeof altitude === 'number') {
          altitudeSource = 'existing';
        } else if (typeof lastKnownAltitude === 'number') {
          altitude = lastKnownAltitude;
          altitudeSource = 'previous';
        } else if (typeof processedData.altitude === 'number') {
          altitude = processedData.altitude;
          altitudeSource = 'current';
        } else {
          altitude = null;
          altitudeSource = 'missing';
        }

        const track =
          existing?.track ?? (isLatest ? processedData.track : undefined);
        const velocity =
          existing?.velocity ?? (isLatest ? processedData.velocity : undefined);

        planeModel.addPositionToHistory(
          entry.lat,
          entry.lon,
          track,
          velocity,
          typeof altitude === 'number'
            ? altitude
            : processedData.altitude ?? undefined,
          entry.timestamp
        );

        if (typeof altitude === 'number') {
          lastKnownAltitude = altitude;
          altitudeValues.push(altitude);
        }

        switch (altitudeSource) {
          case 'existing':
            fallbackStats.restored++;
            break;
          case 'previous':
            fallbackStats.fromPrevious++;
            break;
          case 'current':
            fallbackStats.fromCurrent++;
            break;
          default:
            fallbackStats.missing++;
            break;
        }
      });

      const altCount = altitudeValues.length;
      const minAltitude =
        altCount > 0 ? Math.min(...altitudeValues) : undefined;
      const maxAltitude =
        altCount > 0 ? Math.max(...altitudeValues) : undefined;
      const shouldLog =
        !isExistingPlane ||
        fallbackStats.missing > 0 ||
        altCount === 0 ||
        (typeof maxAltitude === 'number' && maxAltitude <= 50);

      if (shouldLog) {
        console.debug('History sync', {
          icao: processedData.id,
          seeded: !isExistingPlane,
          samples: validHistory.length,
          altitudeSamples: altCount,
          minAltitude,
          maxAltitude,
          fallbackStats,
        });
      }
      return;
    }

    const fallbackTimestamp =
      typeof snapshotTimestamp === 'number' && !Number.isNaN(snapshotTimestamp)
        ? snapshotTimestamp
        : Date.now();

    const lastEntry =
      planeModel.positionHistory[planeModel.positionHistory.length - 1];

    const hasMatchingLastEntry =
      !!lastEntry &&
      Math.abs(lastEntry.lat - processedData.lat) < 0.000001 &&
      Math.abs(lastEntry.lon - processedData.lon) < 0.000001 &&
      lastEntry.timestamp === fallbackTimestamp;

    if (hasMatchingLastEntry) {
      return;
    }

    planeModel.addPositionToHistory(
      processedData.lat,
      processedData.lon,
      processedData.track,
      processedData.velocity,
      processedData.altitude,
      fallbackTimestamp
    );
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

  updateNewPlaneService(currentUpdateSet: Set<string>): void {
    this.newPlaneService.updatePlanes(currentUpdateSet);
  }

  getLastSnapshotTimestamp(): number {
    return this.aircraftSnapshot.getLastUpdate();
  }
}
