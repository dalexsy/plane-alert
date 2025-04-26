import { Component, Input, OnChanges, SimpleChanges, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import * as L from 'leaflet';

@Component({
  selector: 'app-cone',
  template: '',
  encapsulation: ViewEncapsulation.None,
})
export class ConeComponent implements OnChanges, OnDestroy, OnInit {
  @Input() map!: L.Map;
  @Input() lat!: number;
  @Input() lon!: number;
  @Input() opacity: number = 1;
  @Input() distanceKm!: number; // Maximum radius (search area)

  private visualCones: L.Polygon[] = [];
  private arcElements: { path: SVGPathElement; textGroup: SVGElement }[] = [];
  private debounceTimer: any = null;
  private isDrawing = false;
  private mapInitialized = false;
  private coneSvgGroupName = 'cone-segments-group'; // ID for the SVG group
  private initialDrawPending = true; // Flag for initial draw delay
  private labelMarkers: L.Marker[] = []; // Track leaflet markers for labels

  ngOnInit(): void {
    if (this.map && !this.mapInitialized) {
      this.setupMapListeners();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['map'] && this.map && !this.mapInitialized) {
      this.setupMapListeners();
    }

    // Update opacity when it changes
    if ('opacity' in changes && this.mapInitialized) {
      this.updateOpacity();
    }

    // Redraw cones if position or distance changes (removed altitudeMeters)
    if (
      this.mapInitialized &&
      (changes['lat'] || changes['lon'] || changes['distanceKm'])
    ) {
      this.debouncedDrawCones();
    }
  }

  private setupMapListeners(): void {
    if (!this.map) return; // Guard against null map
    this.map.getContainer().classList.add('custom-leaflet-container');
    // Remove potentially existing handlers first (belt-and-suspenders)
    this.map.off('zoomend moveend', this.debouncedDrawCones);
    // Add new handlers
    this.map.on('zoomend moveend', this.debouncedDrawCones);
    this.mapInitialized = true; // Mark as initialized

    // Initial draw - with a slight delay to allow other SVG elements (like main radius) to potentially render first
    setTimeout(() => {
      // Check map still exists and initial draw hasn't happened via other means
      if (this.map && this.initialDrawPending) {
        // console.log('[ConeComponent] Triggering delayed initial draw.');
        this.debouncedDrawCones();
        this.initialDrawPending = false;
      }
    }, 250); // Delay in milliseconds (adjust if needed)

    // Ensure arcs can extend beyond map container
    const container = this.map.getContainer();
    container.style.overflow = 'visible';
    this.map.getPanes().overlayPane.style.overflow = 'visible';
  }

  ngOnDestroy(): void {
    // Clean up event listeners and debounce timer
    if (this.map) {
      this.map.off('zoomend moveend', this.debouncedDrawCones);
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    // Clean up cones and arcs
    this.visualCones.forEach((cone) => this.map?.removeLayer(cone));
    this.visualCones = [];
    const svg = this.map?.getPanes().overlayPane.querySelector('svg');
    if (svg) {
      this.arcElements.forEach(({ path, textGroup }) => {
        if (svg.contains(path)) svg.removeChild(path);
        if (svg.contains(textGroup)) svg.removeChild(textGroup);
      });
    }
    this.arcElements = [];

    // Clean up label markers
    this.labelMarkers.forEach((marker) => this.map?.removeLayer(marker));
    this.labelMarkers = [];

    // Remove the dedicated SVG group on destroy
    const coneGroup = svg?.querySelector(`#${this.coneSvgGroupName}`);
    if (coneGroup && svg?.contains(coneGroup)) {
      svg.removeChild(coneGroup);
      // console.log(
      //   `[ConeComponent] Removed SVG group: ${this.coneSvgGroupName}`
      // );
    }

    // console.log('[ConeComponent] Destroyed');
  }

  // Debounced drawing function to prevent multiple quick redraws
  private debouncedDrawCones = (): void => {
    // Ensure initialDrawPending is false if called directly or via map events after timeout
    this.initialDrawPending = false;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      if (!this.isDrawing) {
        this.isDrawing = true;
        this.drawVisualCones();
        this.isDrawing = false;
      }
    }, 100); // 100ms debounce delay
  };

  private drawVisualCones(): void {
    if (!this.mapInitialized || !this.map) return;

    // Clean up existing cone layers from the map
    this.visualCones.forEach((cone) => this.map.removeLayer(cone));
    this.visualCones = [];

    // Use overlayPane SVG for cone segments
    const svg = this.map
      .getPanes()
      .overlayPane.querySelector('svg') as SVGSVGElement;
    if (!svg) {
      console.error('[ConeComponent] overlayPane SVG not found.');
      return;
    }

    // Clean up existing text arc elements (added directly to SVG)
    this.arcElements.forEach(({ path, textGroup }) => {
      if (svg.contains(path)) svg.removeChild(path);
      if (svg.contains(textGroup)) svg.removeChild(textGroup);
    });
    this.arcElements = [];

    // --- Define Practical Visibility Bands ---

    // 1. Define distance bands (km) - these are the primary structure
    const distancesKm = [5, 10, 20, 30, 40, 50]; // Outer edges of bands
    const maxDistanceKm = distancesKm[distancesKm.length - 1]; // e.g., 50km

    // 2. Define a realistic maximum altitude threshold for the furthest band
    const maxPracticalAltitudeM = 10000; // e.g., 10000m for 50km

    // 3. Calculate a scaling constant based on h = C * d^2
    //    So, maxPracticalAltitudeM = C * (maxDistanceKm * 1000)^2
    const C = maxPracticalAltitudeM / Math.pow(maxDistanceKm * 1000, 2);

    // Define interface for the bands
    interface PracticalVisibilityBand {
      innerKm: number;
      outerKm: number;
      practicalAltM: number; // Plausible altitude threshold for this distance
      color?: string;
    }

    // console.log(
    //   `[ConeComponent] Using distance bands up to ${maxDistanceKm}km.`
    // );
    // console.log(
    //   `[ConeComponent] Scaling altitude thresholds non-linearly up to ${maxPracticalAltitudeM}m.`
    // );

    // 4. Calculate plausible altitude thresholds for each band using h = C * d^2
    const visibilityBands: PracticalVisibilityBand[] = distancesKm.map(
      (outerKm, i) => {
        const innerKm = i === 0 ? 0 : distancesKm[i - 1];
        // Calculate the altitude threshold associated with the *outer edge* of this band
        const practicalAltM = C * Math.pow(outerKm * 1000, 2);

        return { innerKm, outerKm, practicalAltM };
      }
    );

    // 5. Assign colors based on these calculated practical altitudes
    visibilityBands.forEach((band) => {
      const hueRatio =
        maxPracticalAltitudeM > 0
          ? band.practicalAltM / maxPracticalAltitudeM
          : 0;
      // Using sqrt scaling for hue to emphasize lower altitude differences
      const hue = Math.min(Math.sqrt(hueRatio), 1) * 300; // 0 (red) to 300 (purple)
      band.color = `hsl(${Math.floor(hue)}, 100%, 50%)`;
      // console.log(
      //   `Band ${band.innerKm}-${band.outerKm}km → Practical Alt ≈ ${band.practicalAltM.toFixed(0)}m+ → color=${band.color}`
      // );
    });

    // --- Drawing Logic ---
    const angles = [
      { start: 75, end: 190 },
      { start: 245, end: 345 },
    ];

    angles.forEach(({ start, end }) => {
      // Draw from furthest to nearest
      for (let i = visibilityBands.length - 1; i >= 0; i--) {
        const band = visibilityBands[i];
        const bandColor = band.color!;

        if (band.outerKm <= band.innerKm + 0.1) continue;

        const segment = this.createRingSegment(
          this.lat,
          this.lon,
          start,
          end,
          band.innerKm,
          band.outerKm
        );
        // Style each segment directly via Leaflet API
        segment.setStyle({
          color: bandColor,
          fillColor: bandColor,
          fillOpacity: 0.2 * this.opacity,
          weight: 1.5,
          opacity: 0.6 * this.opacity
        });
        segment.addTo(this.map);
        this.visualCones.push(segment);
        segment.bringToFront();
      }
    });

    // Prevent clipping of labels outside SVG bounds
    svg.style.overflow = 'visible';

    // Draw custom text arcs for labels on the third cone ring (20km)
    const ringRadiusKm = distancesKm[1];
    angles.forEach(({ start, end }, idx) => {
      const midStart = start - 10;
      const midEnd = end + 10;
      const label = idx === 0 ? 'Balcony' : 'Streetside';
      // White text color for contrast
      this.addTextArc(
        svg,
        label,
        this.lat,
        this.lon,
        midStart,
        midEnd,
        ringRadiusKm,
        '#fff'
      );
    });

    // console.log(
    //   '[ConeComponent] Completed drawVisualCones with bringToFront ordering'
    // );
  }

  private updateOpacity(): void {
    // Find the cone group
    const svg = this.map?.getPanes().overlayPane.querySelector('svg');
    const coneGroup = svg?.querySelector(
      `#${this.coneSvgGroupName}`
    ) as SVGGElement | null;

    // Apply opacity to the group itself for efficiency
    if (coneGroup) {
      coneGroup.style.opacity = String(this.opacity);
      // Note: Individual fill/stroke opacity set during creation might override this.
      // If finer control needed, iterate through children:
      // Array.from(coneGroup.children).forEach(child => {
      //     (child as SVGElement).style.fillOpacity = String(0.4 * this.opacity);
      //     (child as SVGElement).style.strokeOpacity = String(0.6 * this.opacity);
      // });
    }

    // Update text arc opacity (they are not in the cone group)
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
    // Adjust radius based on zoom for text placement
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

    // Create the invisible path for the text to follow
    const arcPath = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path' // Correctly specify 'path' as the element type
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
    arcPath.setAttribute('stroke', 'none'); // Make path invisible
    svg.appendChild(arcPath);

    // Create the text element
    const textElement = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'text' // Correctly specify 'text' as the element type
    );

    // Create the textPath element to link text to the arc path
    const textPathElement = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'textPath' // Correctly specify 'textPath' as the element type
    );
    textPathElement.setAttribute('href', `#${arcId}`);
    textPathElement.setAttribute('startOffset', '50%');
    textPathElement.setAttribute('text-anchor', 'middle');
    textPathElement.setAttribute('fill', color);
    textPathElement.setAttribute('font-size', '1rem');
    textPathElement.textContent = text;

    // Append textPath to text, and text to SVG
    textElement.appendChild(textPathElement);
    svg.appendChild(textElement);

    // Store references for cleanup
    this.arcElements.push({
      path: arcPath as SVGPathElement, // Type assertion is okay here
      textGroup: textElement as SVGElement, // Use the correct variable name and type assertion
    });
  }

  /**
   * Create a ring segment between inner and outer radius for given angles
   */
  private createRingSegment(
    lat: number,
    lon: number,
    startAngle: number,
    endAngle: number,
    innerKm: number,
    outerKm: number
  ): L.Polygon {
    const pts: L.LatLng[] = [];
    const step = 5;
    // outer arc
    for (let angle = startAngle; angle <= endAngle; angle += step) {
      const [olat, olon] = this.computeDestinationPoint(
        lat,
        lon,
        outerKm,
        angle
      );
      pts.push(L.latLng(olat, olon));
    }
    // inner arc reversed
    for (let angle = endAngle; angle >= startAngle; angle -= step) {
      const [ilat, ilon] = this.computeDestinationPoint(
        lat,
        lon,
        innerKm,
        angle
      );
      pts.push(L.latLng(ilat, ilon));
    }
    // Polygon is created without pane option
    return L.polygon(pts, {
      interactive: false,
      className: 'visual-cone',
    });
  }
}
