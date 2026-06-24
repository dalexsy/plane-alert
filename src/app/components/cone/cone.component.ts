import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import * as L from 'leaflet';
import { AltitudeColorService } from '../../services/altitude-color.service';
import { ViewConeConfig } from '../../services/cone/cone-types';
import {
  cleanupConeLayers,
  drawVisualCones,
  updateConeOpacity,
} from '../../services/cone/cone-draw.util';
import type { ConeDrawContext } from '../../services/cone/cone-types';

export type { ViewConeConfig };

@Component({
  selector: 'app-cone',
  template: '',
  encapsulation: ViewEncapsulation.None,
})
export class ConeComponent implements OnChanges, OnDestroy, OnInit {
  @Input() map!: L.Map;
  @Input() lat!: number;
  @Input() lon!: number;
  @Input() opacity = 1;
  @Input() distanceKm!: number;
  @Input() viewCones: ViewConeConfig[] = [];

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isDrawing = false;
  private mapInitialized = false;
  private readonly coneSvgGroupName = 'cone-segments-group';
  private initialDrawPending = true;
  private readonly drawCtx: ConeDrawContext = {
    map: null!,
    lat: 0,
    lon: 0,
    opacity: 1,
    viewCones: [],
    visualCones: [],
    arcElements: [],
    getFillColor: () => '#fff',
  };

  constructor(private altitudeColor: AltitudeColorService) {
    this.drawCtx.getFillColor = (altM) => this.altitudeColor.getFillColor(altM);
  }

  ngOnInit(): void {
    if (this.map && !this.mapInitialized) this.setupMapListeners();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['map'] && this.map && !this.mapInitialized) {
      this.setupMapListeners();
    }
    if ('opacity' in changes && this.mapInitialized) {
      this.drawCtx.opacity = this.opacity;
      updateConeOpacity(this.drawCtx, this.coneSvgGroupName);
    }
    if (
      this.mapInitialized &&
      (changes['lat'] || changes['lon'] || changes['distanceKm'] || changes['viewCones'])
    ) {
      this.debouncedDrawCones();
    }
  }

  ngOnDestroy(): void {
    if (this.map) this.map.off('zoomend moveend', this.debouncedDrawCones);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    cleanupConeLayers(
      this.map,
      this.drawCtx.visualCones,
      this.drawCtx.arcElements,
      this.coneSvgGroupName
    );
  }

  private setupMapListeners(): void {
    if (!this.map) return;
    this.syncDrawContext();
    this.map.getContainer().classList.add('custom-leaflet-container');
    this.map.off('zoomend moveend', this.debouncedDrawCones);
    this.map.on('zoomend moveend', this.debouncedDrawCones);
    this.mapInitialized = true;
    setTimeout(() => {
      if (this.map && this.initialDrawPending) {
        this.debouncedDrawCones();
        this.initialDrawPending = false;
      }
    }, 250);
    const container = this.map.getContainer();
    container.style.overflow = 'visible';
    this.map.getPanes().overlayPane.style.overflow = 'visible';
  }

  private syncDrawContext(): void {
    this.drawCtx.map = this.map;
    this.drawCtx.lat = this.lat;
    this.drawCtx.lon = this.lon;
    this.drawCtx.opacity = this.opacity;
    this.drawCtx.viewCones = this.viewCones;
  }

  private debouncedDrawCones = (): void => {
    this.initialDrawPending = false;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (this.isDrawing) return;
      this.isDrawing = true;
      this.syncDrawContext();
      drawVisualCones(this.drawCtx);
      this.isDrawing = false;
    }, 100);
  };
}
