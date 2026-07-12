import * as L from 'leaflet';
import type { AirportService } from './airport.service';

export function toggleAirportColor(ctx: AirportService, airportId: number): void {
  const circle = (ctx as any).airportCircles.get(airportId) as L.Circle | undefined;
  if (!circle) return;
  const clicked = (ctx as any).clickedAirports as Set<number>;
  if (clicked.has(airportId)) {
    clicked.delete(airportId);
    circle.setStyle({ color: 'cyan', fillColor: 'url(#airportStripedPatternCyan)' });
  } else {
    clicked.add(airportId);
    circle.setStyle({ color: 'gold', fillColor: 'url(#airportStripedPatternGold)' });
  }
}
