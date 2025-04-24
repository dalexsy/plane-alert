import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import * as L from 'leaflet';

@Component({
  selector: 'app-radius',
  template: '',
})
export class RadiusComponent implements OnChanges, OnDestroy {
  @Input() map!: L.Map;
  @Input() lat!: number;
  @Input() lon!: number;
  @Input() radiusKm!: number;

  private subscribed = false;
  private circle!: L.Circle;

  ngOnChanges(): void {
    if (this.map && this.lat && this.lon && this.radiusKm !== undefined) {
      this.drawRadius();
      if (!this.subscribed) {
        // Redraw on map movement to keep circle positioned
        this.map.on('moveend', this.drawRadius, this);
        this.map.on('zoomend', this.drawRadius, this);
        this.subscribed = true;
      }
    }
  }

  ngOnDestroy(): void {
    if (this.subscribed) {
      this.map.off('moveend', this.drawRadius, this);
      this.map.off('zoomend', this.drawRadius, this);
    }
  }

  private drawRadius(): void {
    // Remove existing circle
    if (this.circle) {
      this.map.removeLayer(this.circle);
    }
    // Draw a simple semi-transparent circle in the overlay pane
    this.circle = L.circle([this.lat, this.lon], {
      pane: 'overlayPane',
      radius: this.radiusKm * 1000,
      color: 'white',
      weight: 2,
      fill: true,
      fillColor: 'rgba(0,0,0,0.3)',
      fillOpacity: 0.3,
    }).addTo(this.map);
    // Send radius behind markers
    this.circle.bringToBack();
  }
}
