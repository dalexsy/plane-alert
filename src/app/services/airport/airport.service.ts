import { Injectable, NgZone } from '@angular/core';
import * as L from 'leaflet';
import { haversineDistance } from '../../utils/geo-utils/geo-utils';
import { findAndDisplayAirports as findAndDisplayAirportsImpl } from './airport-display.util';

interface AirportData {
  name: string;
  code?: string;
}

@Injectable({ providedIn: 'root' })
export class AirportService {
  map!: L.Map;
  airportCircles = new Map<number, L.Circle>();
  airportData = new Map<number, AirportData>();
  airportRadiusCache = new Map<number, number>();
  clickedAirports = new Set<number>();
  loadingAirports = false;
  airportsLoading = false;
  airportRetryTimer: ReturnType<typeof setTimeout> | null = null;
  airportBgRetries = 0;
  currentLat: number | null = null;
  currentLon: number | null = null;

  constructor(public ngZone: NgZone) {}

  initialize(map: L.Map): void {
    this.map = map;
  }

  setClickedAirports(clickedAirports: Set<number>): void {
    this.clickedAirports = new Set(clickedAirports);
  }

  getClickedAirports(): Set<number> {
    return new Set(this.clickedAirports);
  }

  isLoading(): boolean {
    return this.loadingAirports;
  }

  async findAndDisplayAirports(lat: number, lon: number, radiusKm: number, showLabels: boolean): Promise<void> {
    return findAndDisplayAirportsImpl(this, lat, lon, radiusKm, showLabels);
  }

  updateAirportLabels(showLabels: boolean): void {
    this.airportCircles.forEach((circle, id) => {
      const data = this.airportData.get(id);
      if (!data) return;
      circle.unbindTooltip();
      circle.bindTooltip(data.name, {
        direction: 'center',
        className: 'airport-tooltip',
        opacity: 0.8,
        offset: [0, 0],
        permanent: showLabels,
      });
      if (showLabels) circle.openTooltip();
      else circle.closeTooltip();
    });
  }

  getAirportAt(lat: number, lon: number): AirportData | null {
    for (const [id, circle] of this.airportCircles.entries()) {
      const center = circle.getLatLng();
      const dist = haversineDistance(lat, lon, center.lat, center.lng) * 1000;
      if (dist <= circle.getRadius() + 3000) return this.airportData.get(id) || null;
    }
    return null;
  }

  destroy(): void {
    if (this.airportRetryTimer != null) {
      clearTimeout(this.airportRetryTimer);
      this.airportRetryTimer = null;
    }
    this.airportCircles.forEach((circle) => circle.remove());
    this.airportCircles.clear();
    this.airportData.clear();
    this.airportRadiusCache.clear();
    this.clickedAirports.clear();
  }
}
