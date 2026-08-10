import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { haversineDistance } from '../../utils/geo-utils/geo-utils';
import { fetchOverpassJson } from '../airport/overpass-fetch.util';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: { [key: string]: string };
}

const MAJOR_AIRPORT_RADIUS_KM = 5;
const MINOR_AIRPORT_RADIUS_KM = 1;

@Injectable({
  providedIn: 'root',
})
export class AirportInteractionService {
  /** Handle centering map on selected airport coordinates */
  public centerOnAirport(
    map: L.Map,
    coords: { lat: number; lon: number }
  ): void {
    // Pan map to airport coordinates with smooth animation
    map.panTo([coords.lat, coords.lon], { animate: true, duration: 1.0 });
  }

  /**
   * Fetch runway ways around an airport and compute radius as half the longest runway (in km) plus 0.5km buffer.
   */
  public async computeAirportRadiusKm(
    lat: number,
    lon: number,
    hasIata: boolean
  ): Promise<number> {
    const query = `
      [out:json][timeout:25];
      way["aeroway"="runway"](around:10000,${lat},${lon});
      out geom;
    `;

    try {
      const data = await fetchOverpassJson(query);
      let maxLen = 0;

      for (const w of data.elements || []) {
        const coords = (w as { geometry?: Array<{ lat: number; lon: number }> })
          .geometry;
        if (!coords || coords.length < 2) continue;

        // Approximate runway length by first-to-last node
        const start = coords[0];
        const end = coords[coords.length - 1];
        const distKm = haversineDistance(
          start.lat,
          start.lon,
          end.lat,
          end.lon
        );
        maxLen = Math.max(maxLen, distKm);
      }

      if (maxLen > 0) {
        return maxLen / 2 + 0.5; // Half runway plus buffer
      }
    } catch (error) {
      console.warn('Error computing airport radius:', error);
    }

    return hasIata ? MAJOR_AIRPORT_RADIUS_KM : MINOR_AIRPORT_RADIUS_KM;
  }
}
