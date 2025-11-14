import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AircraftSnapshot {
  location: {
    lat: number;
    lon: number;
    radiusKm: number;
  };
  aircraft: any[]; // AdsBPlane[] type from backend
  history: Record<
    string,
    Array<{ lat: number; lon: number; timestamp: number }>
  >; // Position history for trails
  deviceCount: number;
  devices: string[];
  timestamp: any;
  expiresAt: any;
}

@Injectable({
  providedIn: 'root',
})
export class AircraftSnapshotService {
  private aircraftSubject = new BehaviorSubject<any[]>([]);
  public aircraft$ = this.aircraftSubject.asObservable();

  private historySubject = new BehaviorSubject<
    Record<string, Array<{ lat: number; lon: number; timestamp: number }>>
  >({});
  public history$ = this.historySubject.asObservable();

  private lastUpdateSubject = new BehaviorSubject<number>(0);
  public lastUpdate$ = this.lastUpdateSubject.asObservable();

  private unsubscribeFn: (() => void) | null = null;
  private currentLocationKey: string | null = null;
  private db: any = null;
  private firebaseInitialized = false;

  constructor() {}

  /**
   * Lazy-load Firebase and initialize
   */
  private async initFirebase(): Promise<void> {
    if (this.firebaseInitialized) return;

    const { initializeApp, getApps } = await import('firebase/app');
    const { getFirestore } = await import('firebase/firestore');

    if (getApps().length === 0) {
      const firebaseConfig = {
        apiKey: 'AIzaSyAR3v9oNrfHWXjO6nQWZxTqsZx0VG_2WVA',
        authDomain: 'plane-alert-800ff.firebaseapp.com',
        projectId: 'plane-alert-800ff',
        storageBucket: 'plane-alert-800ff.firebasestorage.app',
        messagingSenderId: '393393393900',
        appId: '1:393393393900:web:ba04e04f7c0e4d5f0e9e0e',
      };
      initializeApp(firebaseConfig);
    }
    this.db = getFirestore();
    this.firebaseInitialized = true;
  }

  /**
   * Subscribe to aircraft data for a specific location
   * @param lat Latitude rounded to 2 decimal places
   * @param lon Longitude rounded to 2 decimal places
   * @param radiusKm Search radius in kilometers
   */
  async subscribeToLocation(
    lat: number,
    lon: number,
    radiusKm: number
  ): Promise<void> {
    // Initialize Firebase lazily
    await this.initFirebase();

    // Round to 2 decimal places to match backend grouping
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLon = Math.round(lon * 100) / 100;
    const locationKey = `${roundedLat}_${roundedLon}_${radiusKm}`;

    // Don't resubscribe if already watching this location
    if (this.currentLocationKey === locationKey && this.unsubscribeFn) {
      console.log('Already subscribed to location', locationKey);
      return;
    }

    // Unsubscribe from previous location
    this.unsubscribeFn?.();

    console.log('Subscribing to aircraft snapshot:', locationKey);

    const { doc, onSnapshot, getDoc } = await import('firebase/firestore');

    const docRef = doc(this.db, 'aircraft-snapshots', locationKey);

    // First, fetch existing data immediately (don't wait for realtime update)
    try {
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data() as AircraftSnapshot;
        console.log('Initial aircraft data loaded:', {
          locationKey,
          aircraftCount: data.aircraft?.length || 0,
          historyCount: Object.keys(data.history || {}).length,
        });

        this.aircraftSubject.next(data.aircraft || []);
        this.historySubject.next(data.history || {});
        const serverTimestamp = this.getTimestampMillis(data.timestamp);
        this.lastUpdateSubject.next(serverTimestamp);
      } else {
        console.warn('No existing aircraft data for:', locationKey);
        // Firestore has no data - fetch directly from ADS-B One API
        await this.fetchDirectFromAPI(roundedLat, roundedLon, radiusKm);
      }
    } catch (error) {
      console.error('Error fetching initial aircraft data:', error);
      // On error, try direct API fetch as fallback
      await this.fetchDirectFromAPI(roundedLat, roundedLon, radiusKm);
    }    // Set up realtime listener for future updates
    this.unsubscribeFn = onSnapshot(
      docRef,
      (snapshot: any) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as AircraftSnapshot;
          console.log('Aircraft snapshot received:', {
            locationKey,
            aircraftCount: data.aircraft?.length || 0,
            historyCount: Object.keys(data.history || {}).length,
            timestamp: data.timestamp,
          });

          this.aircraftSubject.next(data.aircraft || []);
          this.historySubject.next(data.history || {});
          const serverTimestamp = this.getTimestampMillis(data.timestamp);
          this.lastUpdateSubject.next(serverTimestamp);
        } else {
          console.warn('Aircraft snapshot not found:', locationKey);
          // Document doesn't exist yet - backend may not have created it
          // Keep existing data and wait for next update
        }
      },
      (error: any) => {
        console.error('Error subscribing to aircraft snapshot:', error);
        // On error, clear data to avoid showing stale information
        this.aircraftSubject.next([]);
      }
    );

    this.currentLocationKey = locationKey;
  }

  /**
   * Fetch aircraft data directly from ADS-B One API as fallback
   */
  private async fetchDirectFromAPI(
    lat: number,
    lon: number,
    radiusKm: number
  ): Promise<void> {
    try {
      const radiusNm = radiusKm / 1.852;
      const url = `https://api.adsb.one/v2/point/${lat}/${lon}/${radiusNm.toFixed(2)}`;

      console.log('Fetching aircraft directly from ADS-B One API:', {
        lat,
        lon,
        radiusKm,
      });

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'plane-alert.surge.sh',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('ADS-B API error:', response.status, response.statusText);
        return;
      }

      const payload = (await response.json()) as { ac?: any[] };
      const aircraft = payload.ac || [];

      console.log('Fetched aircraft from ADS-B One API:', {
        count: aircraft.length,
      });

      // Update local state with API data
      this.aircraftSubject.next(aircraft);
      this.historySubject.next({}); // No history available from direct fetch
      this.lastUpdateSubject.next(Date.now());
    } catch (error) {
      console.error('Error fetching from ADS-B One API:', error);
    }
  }

  /**
   * Unsubscribe from current location updates
   */
  unsubscribeFromLocation(): void {
    this.unsubscribeFn?.();
    this.unsubscribeFn = null;
    this.currentLocationKey = null;
    this.aircraftSubject.next([]);
    console.log('Unsubscribed from aircraft snapshots');
  }

  /**
   * Get current aircraft data synchronously
   */
  getCurrentAircraft(): any[] {
    return this.aircraftSubject.value;
  }

  /**
   * Get current position history synchronously
   */
  getCurrentHistory(): Record<
    string,
    Array<{ lat: number; lon: number; timestamp: number }>
  > {
    return this.historySubject.value;
  }

  /**
   * Get timestamp of last update
   */
  getLastUpdate(): number {
    return this.lastUpdateSubject.value;
  }

  private getTimestampMillis(timestamp: any): number {
    if (timestamp && typeof timestamp.toMillis === 'function') {
      try {
        const millis = timestamp.toMillis();
        if (typeof millis === 'number' && !Number.isNaN(millis)) {
          return millis;
        }
      } catch (err) {
        console.warn('Failed to convert Firestore timestamp, falling back to Date.now()', err);
      }
    }
    return Date.now();
  }
}
