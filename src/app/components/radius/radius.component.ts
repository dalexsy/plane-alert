import { Component, Input, OnChanges } from '@angular/core';
import * as L from 'leaflet';

@Component({
  selector: 'app-radius',
  template: '',
})
export class RadiusComponent implements OnChanges {
  @Input() map!: L.Map;
  @Input() lat!: number;
  @Input() lon!: number;
  @Input() radiusKm!: number;

  private circle!: L.Circle;
  // removed custom svgRenderer and pane logic

  ngOnChanges(): void {
    if (this.map && this.lat && this.lon && this.radiusKm !== undefined) {
      this.drawRadius();
    }
  }

  private drawRadius(): void {
    // Use the overlayPane SVG container for gradient defs
    const svg = this.map
      .getPanes()
      .overlayPane.querySelector('svg') as SVGSVGElement;
    const gradientId = 'circleGradient';
    if (!svg.querySelector(`#${gradientId}`)) {
      const defs = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'defs'
      );
      const radial = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'radialGradient'
      );
      radial.setAttribute('id', gradientId);
      radial.innerHTML =
        '<stop offset="90%" stop-color="black" stop-opacity="0.4"/>' +
        '<stop offset="98%" stop-color="black" stop-opacity="0.6"/>';
      defs.appendChild(radial);
      svg.insertBefore(defs, svg.firstChild);
    }

    if (this.circle) {
      this.map.removeLayer(this.circle);
    }
    this.circle = L.circle([this.lat, this.lon], {
      radius: this.radiusKm * 1000,
      stroke: true,
      color: 'white',
      weight: 4,
      fill: true,
      fillColor: `url(#${gradientId})`,
      fillOpacity: 1,
      className: 'main-radius',
    }).addTo(this.map);
    // Send main radius path to back within overlayPane so airport radius sits above
    this.circle.bringToBack();

    const circlePath = (this.circle as any)._path as SVGElement;
    if (circlePath) {
      // Use normal blend mode so the stroke and fill are visible
      circlePath.style.mixBlendMode = 'normal';
    }
  }
}
