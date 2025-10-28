import { Injectable } from '@angular/core';
import { NgZone } from '@angular/core';
import * as L from 'leaflet';
import { haversineDistance } from '../utils/geo-utils';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: { [key: string]: string };
}

interface AirportData {
  name: string;
  code?: string;
}

const MAJOR_AIRPORT_RADIUS_KM = 5;
const MINOR_AIRPORT_RADIUS_KM = 1;

@Injectable({
  providedIn: 'root',
})
export class AirportService {
  private map!: L.Map;

  // Airport circles keyed by Overpass element ID
  private airportCircles = new Map<number, L.Circle>();

  // Airport metadata keyed by Overpass element ID
  private airportData = new Map<number, AirportData>();

  // Cache computed radii (km) per airport ID to avoid repeat Overpass calls
  private airportRadiusCache = new Map<number, number>();

  // Track clicked airports for color toggling
  private clickedAirports = new Set<number>();

  // Flag for airport fetching (loading) to show loading indicator
  private loadingAirports = false;

  // Guard for Overpass fetches
  private airportsLoading = false;

  // Track current location to detect location changes
  private currentLat: number | null = null;
  private currentLon: number | null = null;

  constructor(private ngZone: NgZone) {}

  /**
   * Initialize the service with the map instance
   */
  initialize(map: L.Map): void {
    this.map = map;
  }

  /**
   * Set the clicked airports from settings
   */
  setClickedAirports(clickedAirports: Set<number>): void {
    this.clickedAirports = new Set(clickedAirports);
  }

  /**
   * Get the current clicked airports
   */
  getClickedAirports(): Set<number> {
    return new Set(this.clickedAirports);
  }

  /**
   * Get loading state
   */
  isLoading(): boolean {
    return this.loadingAirports;
  }

  /**
   * Find and display airports within the given radius
   */
  async findAndDisplayAirports(
    lat: number,
    lon: number,
    radiusKm: number,
    showLabels: boolean
  ): Promise<void> {
    // Check if location has meaningfully changed (>1km)
    const locationChanged =
      this.currentLat === null ||
      this.currentLon === null ||
      Math.abs(lat - this.currentLat) > 0.01 ||
      Math.abs(lon - this.currentLon) > 0.01;

    if (!locationChanged && this.airportCircles.size > 0) {
      // Same location, just update label visibility
      this.updateAirportLabels(showLabels);
      return;
    }

    if (this.airportsLoading) {
      return;
    }
    this.airportsLoading = true;

    this.ngZone.run(() => {
      this.loadingAirports = true;
    });

    // Update current location
    this.currentLat = lat;
    this.currentLon = lon;

    // Clear existing airports from previous location
    this.airportCircles.forEach((circle) => circle.remove());
    this.airportCircles.clear();
    this.airportData.clear();
    // Keep clicked airports and radius cache for persistence

    try {
      // Track runway radius promises to delay spinner hiding
      const radiusPromises: Promise<void>[] = [];

      const radiusMeters = radiusKm * 1000;
      const overpassUrl = 'https://overpass-api.de/api/interpreter';

      // Query for nodes, ways, and relations tagged as aerodromes within the radius
      const query = `
        [out:json][timeout:25];
        (
          node["aeroway"="aerodrome"](around:${radiusMeters},${lat},${lon});
          way["aeroway"="aerodrome"](around:${radiusMeters},${lat},${lon});
          relation["aeroway"="aerodrome"](around:${radiusMeters},${lat},${lon});
        );
        out center;
      `;

      const response = await fetch(overpassUrl, {
        method: 'POST',
        body: query,
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.statusText}`);
      }

      const data = await response.json();
      const foundAirportIds = new Set<number>();

      for (const element of data.elements || []) {
        if (element.type === 'node' || element.center) {
          const airportLat = element.lat ?? element.center?.lat;
          const airportLon = element.lon ?? element.center?.lon;
          const airportId = element.id;

          if (airportLat !== undefined && airportLon !== undefined) {
            const name = element.tags?.['name'] || 'Unknown Airport';
            const code = element.tags?.['iata'] || '';

            // Store metadata
            this.airportData.set(airportId, { name, code });
            foundAirportIds.add(airportId);

            // Determine radius: use runway lengths if available, fallback to IATA presence
            const defaultKm = code
              ? MAJOR_AIRPORT_RADIUS_KM
              : MINOR_AIRPORT_RADIUS_KM;
            const useKm = this.airportRadiusCache.get(airportId) ?? defaultKm;

            // Check if circle already exists
            if (!this.airportCircles.has(airportId)) {
              // Determine initial color based on clicked state
              const isClicked = this.clickedAirports.has(airportId);
              const circleColor = isClicked ? 'gold' : 'cyan';
              const fillPattern = isClicked
                ? 'url(#airportStripedPatternGold)'
                : 'url(#airportStripedPatternCyan)';

              const circle = L.circle([airportLat, airportLon], {
                radius: useKm * 1000,
                color: circleColor,
                weight: 2,
                fill: true,
                fillColor: fillPattern,
                fillOpacity: 0.3,
                className: 'airport-radius',
                interactive: true,
              }).addTo(this.map);

              // Add click event handler to toggle color
              circle.on('click', () => {
                this.toggleAirportColor(airportId);
              });

              // Always bind tooltip; use `permanent` to show/hide labels
              circle.bindTooltip(name, {
                direction: 'center',
                className: 'airport-tooltip',
                opacity: 0.8,
                offset: [0, 0],
                permanent: showLabels,
              });

              this.airportCircles.set(airportId, circle);

              // Use default radius until bulk runway query updates it
              if (!this.airportRadiusCache.has(airportId)) {
                this.airportRadiusCache.set(airportId, defaultKm);
              }
            } else {
              // Update existing circle color based on clicked state
              const existingCircle = this.airportCircles.get(airportId);
              if (existingCircle) {
                const isClicked = this.clickedAirports.has(airportId);
                const circleColor = isClicked ? 'gold' : 'cyan';
                const fillPattern = isClicked
                  ? 'url(#airportStripedPatternGold)'
                  : 'url(#airportStripedPatternCyan)';
                existingCircle.setStyle({
                  color: circleColor,
                  fillColor: fillPattern,
                });
              }
            }
          }
        }
      }

      // Remove circles for airports no longer in the result set
      this.airportCircles.forEach((circle, id) => {
        if (!foundAirportIds.has(id)) {
          circle.remove();
          this.airportCircles.delete(id);
          this.airportData.delete(id);
          this.clickedAirports.delete(id);
        }
      });

      // Bulk fetch runway data for all airports at once
      if (this.airportCircles.size > 0) {
        const airportList = Array.from(this.airportCircles.entries()).map(
          ([id, circle]) => ({
            id,
            lat: circle.getLatLng().lat,
            lon: circle.getLatLng().lng,
            hasIata: !!this.airportData.get(id)?.code,
          })
        );

        // Compute bbox covering all airports plus margin
        const lats = airportList.map((a) => a.lat);
        const lons = airportList.map((a) => a.lon);
        const minLat = Math.min(...lats) - radiusKm / 111;
        const maxLat = Math.max(...lats) + radiusKm / 111;
        const minLon = Math.min(...lons) - radiusKm / 111;
        const maxLon = Math.max(...lons) + radiusKm / 111;

        const runwayQuery = `
          [out:json][timeout:25];
          (
            way["aeroway"="runway"](${minLat},${minLon},${maxLat},${maxLon});
            node["aeroway"="runway"](${minLat},${minLon},${maxLat},${maxLon});
          );
          out geom;
        `;

        const runwayPromise = fetch(overpassUrl, {
          method: 'POST',
          body: runwayQuery,
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!data?.elements) return;

            const lengthsByAirport = new Map<number, number>();
            data.elements.forEach((elem: any) => {
              const coords = elem.geometry;
              if (!coords || coords.length < 2) return;

              // Compute runway length between first and last point
              const start = coords[0];
              const end = coords[coords.length - 1];
              const lenKm = haversineDistance(
                start.lat,
                start.lon,
                end.lat,
                end.lon
              );

              // Find nearest airport center
              let bestId = null;
              let bestDist = Infinity;
              airportList.forEach((a) => {
                const d = haversineDistance(
                  a.lat,
                  a.lon,
                  (start.lat + end.lat) / 2,
                  (start.lon + end.lon) / 2
                );
                if (d < bestDist) {
                  bestDist = d;
                  bestId = a.id;
                }
              });

              if (bestId != null) {
                const prev = lengthsByAirport.get(bestId) || 0;
                lengthsByAirport.set(bestId, Math.max(prev, lenKm));
              }
            });

            // Apply computed radii
            airportList.forEach((a) => {
              const circle = this.airportCircles.get(a.id);
              const maxLen = lengthsByAirport.get(a.id) || 0;
              const radius =
                maxLen > 0
                  ? maxLen / 2 + 0.5
                  : a.hasIata
                  ? MAJOR_AIRPORT_RADIUS_KM
                  : MINOR_AIRPORT_RADIUS_KM;
              this.airportRadiusCache.set(a.id, radius);
              if (circle) circle.setRadius(radius * 1000);
            });
          })
          .catch(() => {});

        radiusPromises.push(runwayPromise);
      }

      // Wait for all runway radius updates before hiding spinner
      await Promise.all(radiusPromises);

      // Increase opacity of all airport circles after resizing
      this.airportCircles.forEach((circle) =>
        circle.setStyle({ fillOpacity: 0.6 })
      );

      // Hide loading indicator inside Angular zone
      this.ngZone.run(() => {
        this.loadingAirports = false;
      });
    } catch (error) {
      // Hide loading indicator on error
      this.ngZone.run(() => {
        this.loadingAirports = false;
      });
    } finally {
      this.airportsLoading = false;
    }
  }

  /**
   * Toggle airport color between cyan and gold
   */
  private toggleAirportColor(airportId: number): void {
    const circle = this.airportCircles.get(airportId);
    if (!circle) return;

    const currentlyClicked = this.clickedAirports.has(airportId);
    if (currentlyClicked) {
      // Remove from clicked set and change to cyan
      this.clickedAirports.delete(airportId);
      circle.setStyle({
        color: 'cyan',
        fillColor: 'url(#airportStripedPatternCyan)',
      });
    } else {
      // Add to clicked set and change to gold
      this.clickedAirports.add(airportId);
      circle.setStyle({
        color: 'gold',
        fillColor: 'url(#airportStripedPatternGold)',
      });
    }
  }

  /**
   * Update airport label visibility
   */
  updateAirportLabels(showLabels: boolean): void {
    this.airportCircles.forEach((circle, id) => {
      const data = this.airportData.get(id);
      if (!data) return;

      // Rebind tooltip with permanent flag toggled
      circle.unbindTooltip();
      circle.bindTooltip(data.name, {
        direction: 'center',
        className: 'airport-tooltip',
        opacity: 0.8,
        offset: [0, 0],
        permanent: showLabels,
      });

      // Open or close tooltip based on permanent flag
      if (showLabels) {
        circle.openTooltip();
      } else {
        circle.closeTooltip();
      }
    });
  }

  /**
   * Get airport data for a given position
   */
  getAirportAt(lat: number, lon: number): AirportData | null {
    for (const [id, circle] of this.airportCircles.entries()) {
      const center = circle.getLatLng();
      const radiusMeters = circle.getRadius();
      const dist = haversineDistance(lat, lon, center.lat, center.lng) * 1000;

      // Allow assignment for planes within circle or within 3km outside
      if (dist <= radiusMeters + 3000) {
        return this.airportData.get(id) || null;
      }
    }
    return null;
  }

  /**
   * Clean up airport circles
   */
  destroy(): void {
    this.airportCircles.forEach((circle) => circle.remove());
    this.airportCircles.clear();
    this.airportData.clear();
    this.airportRadiusCache.clear();
    this.clickedAirports.clear();
  }
}
