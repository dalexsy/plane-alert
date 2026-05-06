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
import {
  isMilitaryOperator,
  isMilitaryCallsign,
  looksMilitary,
  getAircraftTypeName,
} from '@plane-alert/shared';
import { getDefaultMilitaryOperator } from '../config/military-operators.config';
import {
  AircraftDbService,
  AircraftRecord,
} from '../services/aircraft-db.service';
import { filterPlaneByPrefix } from '../utils/plane-log';
import { AircraftSnapshotService } from './aircraft-snapshot.service';
import { OpenskyRouteService } from './opensky-route.service';
import {
  calculateDistanceKm,
  computeBearingDeg,
  bearingToCardinal,
  cardinalToArrow,
} from './plane-data/plane-geo.util';
import { PlaneRouteCacheService } from './plane-data/plane-route-cache.service';
import { UnknownCountryLoggerService } from './plane-data/unknown-country-logger.service';

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
  routeOriginIata?: string;
  routeDestinationIata?: string;
  routeOriginName?: string;
  routeDestinationName?: string;
  routeEtaUtc?: string;
  routeStatus?: string;
  routeArrivalDelay?: number;
  routeCancelled?: boolean;
  routeDiverted?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class PlaneDataService {
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
    private openskyRouteService: OpenskyRouteService,
    private routeCache: PlaneRouteCacheService,
    private unknownCountryLogger: UnknownCountryLoggerService,
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
    radiusKm: number,
  ): Promise<any[]> {
    try {
      // Subscribe to Firestore realtime updates for this location
      // Wait for initial data to be loaded before returning
      await this.aircraftSnapshot.subscribeToLocation(
        centerLat,
        centerLon,
        radiusKm,
      );

      // Return current cached data (now populated with initial fetch)
      const aircraft = this.aircraftSnapshot.getCurrentAircraft();
      const flightData = this.aircraftSnapshot.getCurrentFlightData();

      // Store flight data for route enrichment
      this.routeCache.updateFromFlightData(flightData);

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
      icao: string,
    ) => { model?: string; ownop?: string; mil?: boolean } | null,
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

    // Fetch DB record from user database only (no longer loads 607k main DB)
    const dbAircraft = getAircraftInfo(id);

    // Note: dbAircraft is now only for user-added aircraft
    // API provides most data, so missing dbAircraft is fine

    // Collect operator hints early so military classification can use them too.
    const opIcao: string =
      typeof ac.opicao === 'string' ? ac.opicao.trim() : '';
    const opIcaoOperator = opIcao
      ? this.operatorCallSignService.getOperator(opIcao)
      : undefined;
    const canUseCallsignOperatorFallback =
      !!callsign && !!categoryCode && categoryCode.startsWith('A');
    const prefixOperator = canUseCallsignOperatorFallback
      ? this.operatorCallSignService.getOperatorWithLogging(callsign)
      : undefined;

    // Determine military status using both source flags and strong heuristics.
    // This catches known military flights (e.g., MMF/NATO tankers) that may lack
    // explicit mil/dbFlags in some feeds.
    const baseIsMilitary = looksMilitary(ac);
    const hasMilitaryHeuristic =
      isMilitaryCallsign(callsign) ||
      isMilitaryOperator(opIcaoOperator) ||
      isMilitaryOperator(prefixOperator) ||
      isMilitaryOperator(dbAircraft?.ownop) ||
      /\bNATO\b/i.test(opIcaoOperator || '') ||
      /\bNATO\b/i.test(prefixOperator || '') ||
      /\bNATO\b/i.test(dbAircraft?.ownop || '') ||
      /^MMF\d+/i.test(callsign);
    const isMilitary = baseIsMilitary || hasMilitaryHeuristic;

    // Derive country using the aircraft country service
    const rawCountry = ac.ctry ?? ac.countryCode;
    const origin = this.aircraftCountryService.getAircraftCountry(
      reg,
      id,
      rawCountry,
      isMilitary,
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

    // Altitudes from the backend snapshot are in feet (ADS-B style fields).
    // We store meters internally, but we intentionally suppress non-positive values
    // to avoid showing confusing negative "altitudes" while taxiing / on ground.
    const altitudeFeetCandidate =
      typeof ac.alt_baro === 'number'
        ? ac.alt_baro
        : typeof ac.alt_geom === 'number'
          ? ac.alt_geom
          : null;

    // Determine if on ground
    let onGroundBasedOnLogic = false;
    const altitudeForHeuristicCheck: number | undefined =
      ac.alt_baro === 'ground'
        ? 0
        : typeof ac.alt_baro === 'number'
          ? ac.alt_baro
          : typeof ac.alt_geom === 'number'
            ? ac.alt_geom
            : undefined;

    if (
      typeof altitudeForHeuristicCheck === 'number' &&
      altitudeForHeuristicCheck < 150 &&
      typeof velocity === 'number' &&
      velocity < 50
    ) {
      onGroundBasedOnLogic = true;
    }

    const onGround =
      ac.gnd === true ||
      ac.ground === true ||
      ac.alt_baro === 'ground' ||
      onGroundBasedOnLogic;

    // Process altitude (feet -> meters). Align with backend notification logic:
    // - If we're on the ground, force altitude to 0
    // - Otherwise, only accept strictly-positive altitude values
    let altitude: number | null = null;
    if (onGround) {
      altitude = 0;
    } else if (
      typeof altitudeFeetCandidate === 'number' &&
      altitudeFeetCandidate > 0
    ) {
      altitude = altitudeFeetCandidate * 0.3048;
    } else {
      altitude = null;
    }

    // For downstream logic that still expects a numeric feet value
    const altitudeFeet =
      typeof altitudeFeetCandidate === 'number' ? altitudeFeetCandidate : 0;

    const isUnknown = this.unknownListService.isUnknown(id);

    // Check if plane should be filtered
    const wouldBeFiltered = filterPlaneByPrefix(
      callsign,
      excludeDiscount,
      blockedPrefixes,
    );
    const isFiltered = isInitialLoad
      ? false
      : isMilitary
        ? false
        : wouldBeFiltered;

    // Check distance from center
    const dist = calculateDistanceKm(centerLat, centerLon, lat, lon);
    if (dist > radiusKm) {
      return null; // Out of range
    }

    const isNew = this.newPlaneService.isNew(id);

    // Determine operator and model
    // Operator sources (in order):
    // 1) API-derived operator ICAO (opicao) (best)
    // 2) Local DB (ownop)
    // 3) Callsign-prefix mapping (fallback) BUT only for likely-aircraft records (category A*)

    // ADS-B One sometimes provides operator ICAO separately (even when callsign/flight is blank).
    // This is a no-cost enrichment that can improve operator name + logo matching.

    // Prevent bogus civilian airline names from showing on military aircraft.
    // Example: callsign prefix mappings can incorrectly label military flights.
    const safePrefixOperator =
      isMilitary && prefixOperator && !isMilitaryOperator(prefixOperator)
        ? undefined
        : prefixOperator;

    const safeOpIcaoOperator =
      isMilitary && opIcaoOperator && !isMilitaryOperator(opIcaoOperator)
        ? undefined
        : opIcaoOperator;

    // Prefer API-derived operator (opicao) first; then explicit DB operator; then callsign fallback.
    let operator =
      safeOpIcaoOperator ?? dbAircraft?.ownop ?? safePrefixOperator ?? '';

    // Model priority: API description > DB model > ICAO type code (converted to readable name)
    let model = apiModel || dbAircraft?.model || '';
    if (!model && apiIcaoType) {
      // Convert ICAO type code (e.g., "B738") to readable name (e.g., "Boeing 737-800")
      model = getAircraftTypeName(apiIcaoType);
    }

    // Fallback: Military flights often omit an operator string.
    // Use country-based default military operator name when available.
    if (isMilitary && (!operator || !operator.trim()) && origin) {
      const defaultOperator = getDefaultMilitaryOperator(origin);
      if (defaultOperator) {
        operator = defaultOperator;
      }
    }

    if (
      !model &&
      this.helicopterIdentificationService.isHelicopter(
        id,
        model,
        operator,
        categoryCode,
        apiIcaoType,
        callsign,
      )
    ) {
      model = 'Helicopter';
    }

    const isBalloon = apiIcaoType.trim().toUpperCase() === 'BALL';
    const isSpecial = this.specialListService.isSpecial(id) || isBalloon;

    // Check if this is an A380 for visual highlighting
    const isA380 = model && /a\s*-?\s*380/i.test(model);

    // Add unknown aircraft to USER database (not the huge main one)
    // Only add if truly missing data from both API and user DB
    if (!dbAircraft && !apiModel && !operator) {
      // Only store aircraft that are completely unknown
      // Don't pollute user DB with aircraft that have API data
      let dbModel = apiModel || '';
      if (
        !dbModel &&
        this.helicopterIdentificationService.isHelicopter(
          id,
          dbModel,
          operator,
          categoryCode,
          apiIcaoType,
          callsign,
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
    this.unknownCountryLogger.logUnknownCountryIfNeeded({
      icao: id,
      registration: reg,
      operator,
      rawCountry: rawCountry || '',
      callsign,
      detectedCountry: origin,
      isMilitary,
    });

    // Fetch route data asynchronously (non-blocking)
    // This will use cached data if available
    this.openskyRouteService.getFlightRoute(id).subscribe((route) => {
      if (route && (route.origin || route.destination)) {
        const cached = this.routeCache.get(callsign, id) ?? {};
        this.routeCache.merge(callsign, {
          origin: cached.origin ?? route.origin,
          destination: cached.destination ?? route.destination,
        });
      }
    });

    // Get cached route data if available - check by callsign first (AeroAPI), then by ICAO (OpenSky)
    const cachedRoute = this.routeCache.get(callsign, id);

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
      routeOriginIata: cachedRoute?.originIata,
      routeDestinationIata: cachedRoute?.destinationIata,
      routeOriginName: cachedRoute?.originName,
      routeDestinationName: cachedRoute?.destinationName,
      routeEtaUtc: cachedRoute?.etaUtc,
      routeStatus: cachedRoute?.status,
      routeArrivalDelay: cachedRoute?.arrivalDelay,
      routeCancelled: cachedRoute?.cancelled,
      routeDiverted: cachedRoute?.diverted,
    };
  }

  createOrUpdatePlaneModel(
    processedData: ProcessedPlaneData,
    previousLog: Map<string, PlaneModel>,
    centerLat: number,
    centerLon: number,
    snapshotTimestamp?: number,
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
      isExistingPlane,
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
    planeModelInstance.routeOriginIata = processedData.routeOriginIata;
    planeModelInstance.routeDestinationIata =
      processedData.routeDestinationIata;
    planeModelInstance.routeOriginName = processedData.routeOriginName;
    planeModelInstance.routeDestinationName =
      processedData.routeDestinationName;
    planeModelInstance.routeEtaUtc = processedData.routeEtaUtc;
    planeModelInstance.routeStatus = processedData.routeStatus;
    planeModelInstance.routeArrivalDelay = processedData.routeArrivalDelay;
    planeModelInstance.routeCancelled = processedData.routeCancelled;
    planeModelInstance.routeDiverted = processedData.routeDiverted;

    // Calculate derived properties
    const bearing = computeBearingDeg(centerLat, centerLon, lat, lon);
    const cardinal = bearingToCardinal(bearing);
    const arrow = cardinalToArrow(cardinal);

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
    isExistingPlane: boolean,
  ): void {
    const validHistory = Array.isArray(planeHistory)
      ? planeHistory.filter(
          (entry) =>
            entry &&
            typeof entry.lat === 'number' &&
            typeof entry.lon === 'number' &&
            typeof entry.timestamp === 'number',
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
            : (processedData.altitude ?? undefined),
          entry.timestamp,
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

      // IMPORTANT: backend history sometimes lags the current snapshot payload.
      // If we don't append the latest processedData position, the last 2 history points
      // can be older than the marker target, causing "mid-flight" animations to use
      // stale segments (looks like it's replaying multiple scans).
      const latestTs =
        typeof snapshotTimestamp === 'number' &&
        !Number.isNaN(snapshotTimestamp)
          ? snapshotTimestamp
          : Date.now();

      const lastBuilt =
        planeModel.positionHistory[planeModel.positionHistory.length - 1];
      const matchesProcessed =
        !!lastBuilt &&
        Math.abs(lastBuilt.lat - processedData.lat) < 0.000001 &&
        Math.abs(lastBuilt.lon - processedData.lon) < 0.000001;

      if (!matchesProcessed) {
        planeModel.addPositionToHistory(
          processedData.lat,
          processedData.lon,
          processedData.track,
          processedData.velocity,
          processedData.altitude,
          latestTs,
        );
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
      fallbackTimestamp,
    );
  }

  updateNewPlaneService(currentUpdateSet: Set<string>): void {
    this.newPlaneService.updatePlanes(currentUpdateSet);
  }

  getLastSnapshotTimestamp(): number {
    return this.aircraftSnapshot.getLastUpdate();
  }
}
