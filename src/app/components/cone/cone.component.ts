import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import * as L from 'leaflet';

@Component({
  selector: 'app-cone',
  template: '',
})
export class ConeComponent implements OnChanges {
  @Input() map!: L.Map;
  @Input() lat!: number;
  @Input() lon!: number;
  @Input() distanceKm!: number;
  @Input() opacity: number = 1; // Add opacity input

  private visualCones: L.Polygon[] = [];
  private arcElements: { path: SVGPathElement; textGroup: SVGElement }[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if ('opacity' in changes) {
      this.updateOpacity();
    }
    if (this.map && this.lat && this.lon && this.distanceKm) {
      this.map.getContainer().classList.add('custom-leaflet-container');
      this.map.on('zoomend moveend', () => {
        this.drawVisualCones();
      });
      this.drawVisualCones();
    }
  }

  private drawVisualCones(): void {
    // Debug overlayPane and SVG children for stacking order
    console.log(
      '[ConeComponent] overlayPane children:',
      this.map.getPanes().overlayPane.children
    );
    const svg = this.map
      .getPanes()
      .overlayPane.querySelector('svg') as SVGSVGElement;
    console.log(
      '[ConeComponent] overlayPane SVG child count:',
      svg?.childNodes.length
    );
    this.visualCones.forEach((cone) => this.map.removeLayer(cone));
    this.visualCones = [];

    // Remove old arcs
    this.arcElements.forEach(({ path, textGroup }) => {
      if (svg.contains(path)) svg.removeChild(path);
      if (svg.contains(textGroup)) svg.removeChild(textGroup);
    });
    this.arcElements = [];

    const patternId = 'stripePattern';
    if (svg && !svg.querySelector(`#${patternId}`)) {
      const defs = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'defs'
      );
      const pattern = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'pattern'
      );
      pattern.setAttribute('id', patternId);
      pattern.setAttribute('width', '4');
      pattern.setAttribute('height', '4');
      pattern.setAttribute('patternUnits', 'userSpaceOnUse');
      pattern.setAttribute('patternTransform', 'rotate(45)');

      const rect = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect'
      );
      rect.setAttribute('width', '2');
      rect.setAttribute('height', '4');
      rect.setAttribute('fill', 'white');
      rect.setAttribute('fill-opacity', '0.5');

      pattern.appendChild(rect);
      defs.appendChild(pattern);
      svg.insertBefore(defs, svg.firstChild);
    }

    // define and use cone shape radius for both polygons and labels
    const coneRadiusKm = 12;
    const cone1 = this.createCone(this.lat, this.lon, 75, 190, coneRadiusKm);
    const cone2 = this.createCone(this.lat, this.lon, 245, 345, coneRadiusKm);

    cone1.addTo(this.map);
    cone2.addTo(this.map);
    this.visualCones.push(cone1, cone2);

    this.addTextArc(
      svg,
      'Balcony',
      this.lat,
      this.lon,
      75,
      190,
      coneRadiusKm,
      'white'
    );
    this.addTextArc(
      svg,
      'Streetside',
      this.lat,
      this.lon,
      245,
      345,
      coneRadiusKm,
      'white'
    );

    // Set opacity after drawing
    this.updateOpacity();
  }

  private updateOpacity(): void {
    this.visualCones.forEach((cone) => {
      const path = (cone as any)._path as SVGElement;
      if (path) {
        path.style.opacity = String(this.opacity);
      }
    });
    this.arcElements.forEach(({ path, textGroup }) => {
      path.style.opacity = String(this.opacity);
      textGroup.style.opacity = String(this.opacity);
    });
  }

  private createCone(
    lat: number,
    lon: number,
    startAngle: number,
    endAngle: number,
    distanceKm: number
  ): L.Polygon {
    const points: L.LatLng[] = [L.latLng(lat, lon)];
    const step = 5;
    for (let angle = startAngle; angle <= endAngle; angle += step) {
      const [destLat, destLon] = this.computeDestinationPoint(
        lat,
        lon,
        distanceKm,
        angle
      );
      points.push(L.latLng(destLat, destLon));
    }
    points.push(L.latLng(lat, lon));
    return L.polygon(points, {
      className: 'visual-cone',
      interactive: false,
      color: 'white',
      fill: true,
      fillColor: 'url(#stripePattern)',
      fillOpacity: 1,
    });
  }

  private computeDestinationPoint(
    lat: number,
    lon: number,
    distanceKm: number,
    bearingDeg: number
  ): [number, number] {
    const R = 6371;
    const bearing = (bearingDeg * Math.PI) / 180;
    const lat1 = (lat * Math.PI) / 180;
    const lon1 = (lon * Math.PI) / 180;
    const dByR = distanceKm / R;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(dByR) +
        Math.cos(lat1) * Math.sin(dByR) * Math.cos(bearing)
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(dByR) * Math.cos(lat1),
        Math.cos(dByR) - Math.sin(lat1) * Math.sin(lat2)
      );
    return [(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI];
  }

  private addTextArc(
    svg: SVGSVGElement,
    text: string,
    lat: number,
    lon: number,
    startAngle: number,
    endAngle: number,
    coneRadiusKm: number,
    color: string
  ): void {
    const zoom = this.map.getZoom();
    const radiusKm = coneRadiusKm * 1.05 * Math.pow(8 / zoom, 2);
    const points: L.LatLng[] = [];
    const step = 5;
    for (let angle = startAngle; angle <= endAngle; angle += step) {
      const [destLat, destLon] = this.computeDestinationPoint(
        lat,
        lon,
        radiusKm,
        angle
      );
      points.push(L.latLng(destLat, destLon));
    }
    const arcPath = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path'
    );
    const arcId = `arc-${text
      .toLowerCase()
      .replace(/\s+/g, '-')}-${Date.now()}`;
    arcPath.setAttribute('id', arcId);
    const pathD = points
      .map((point, i) => {
        const p = this.map.latLngToLayerPoint(point);
        return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
      })
      .join(' ');
    arcPath.setAttribute('d', pathD);
    arcPath.setAttribute('fill', 'none');
    arcPath.setAttribute('stroke', 'none');
    svg.appendChild(arcPath);
    const textEl = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'text'
    );
    const textPath = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'textPath'
    );
    textPath.setAttribute('href', `#${arcId}`);
    textPath.setAttribute('startOffset', '50%');
    textPath.setAttribute('text-anchor', 'middle');
    textPath.setAttribute('fill', color);
    textPath.setAttribute('font-size', '1rem');
    textPath.textContent = text;
    textEl.appendChild(textPath);
    svg.appendChild(textEl);
    this.arcElements.push({
      path: arcPath as SVGPathElement,
      textGroup: textEl,
    });
  }
}
