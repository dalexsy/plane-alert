import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { SettingsService } from '../settings/settings.service';

@Injectable({
  providedIn: 'root',
})
export class ConeDisplayService {
  // Store cone layers on the map
  private coneLayers: L.Polygon[] = [];

  constructor(private settings: SettingsService) {}

  /** Toggle display of cone/view axes */
  public toggleConeVisibility(map: L.Map, show: boolean): void {
    if (show) {
      this.showCones(map);
    } else {
      this.hideCones();
    }
  }

  /** Show cone layers on the map */
  private showCones(map: L.Map): void {
    this.hideCones(); // Clear any existing cones first

    const homeLocation = this.settings.getHomeLocation();
    if (!homeLocation) return;

    const lat = homeLocation.lat;
    const lon = homeLocation.lon;

    // Define cone angles (matching ConeComponent)
    const cones = [
      { start: 75, end: 190, color: '#ff0000', label: 'Balcony' }, // ENE to S
      { start: 245, end: 345, color: '#00ff00', label: 'Streetside' }, // SW to N
    ];

    // Create cone polygons
    cones.forEach((cone) => {
      const polygon = this.createConePolygon(
        lat,
        lon,
        cone.start,
        cone.end,
        cone.color
      );
      polygon.addTo(map);
      this.coneLayers.push(polygon);
    });
  }

  /** Hide all cone layers */
  private hideCones(): void {
    this.coneLayers.forEach((layer) => {
      layer.remove();
    });
    this.coneLayers = [];
  }

  /** Create a cone polygon for given angles */
  private createConePolygon(
    centerLat: number,
    centerLon: number,
    startAngle: number,
    endAngle: number,
    color: string
  ): L.Polygon {
    const points: [number, number][] = [];
    const radiusKm = 10; // 10km radius for cones
    const segments = 32; // Number of segments for smooth curve

    // Add center point
    points.push([centerLat, centerLon]);

    // Add arc points
    const angleRange = endAngle - startAngle;
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (angleRange * i) / segments;
      const radian = (angle * Math.PI) / 180;

      // Convert to lat/lon
      const lat = centerLat + (radiusKm / 111.32) * Math.cos(radian);
      const lon =
        centerLon +
        (radiusKm / (111.32 * Math.cos((centerLat * Math.PI) / 180))) *
          Math.sin(radian);

      points.push([lat, lon]);
    }

    return L.polygon(points, {
      color: color,
      fillColor: color,
      fillOpacity: 0.1,
      weight: 2,
      opacity: 0.7,
    });
  }

  /** Clear all cone layers */
  public clearCones(): void {
    this.hideCones();
  }
}
