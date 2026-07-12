import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  OnInit,
  OnDestroy,
  HostListener,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AltitudeColorService } from '../../services/altitude-color/altitude-color.service';
import { BrightnessService, BrightnessState } from '../../services/brightness/brightness.service';
import { CelestialService } from '../../services/celestial/celestial.service';
import { ScanService } from '../../services/scan/scan.service';
import { StormPressureService } from '../../services/storm-pressure/storm-pressure.service';
import { RainOverlayComponent } from '../rain-overlay/rain-overlay.component';
import { SkyBackgroundComponent } from '../sky-background/sky-background.component';
import { CelestialObjectsComponent } from '../celestial-objects/celestial-objects.component';
import { CompassLabelsComponent } from '../compass-labels/compass-labels.component';
import { AltitudeBandsComponent, AltitudeTick } from './altitude-bands/altitude-bands.component';
import { MarkerLinesComponent } from '../marker-lines/marker-lines.component';
import { DimOverlayComponent, DimSegment } from './dim-overlay/dim-overlay.component';
import { AircraftContainerComponent } from '../aircraft-container/aircraft-container.component';
import { SwallowAnimationComponent } from '../swallow-animation/swallow-animation.component';
import { FallLeavesAnimationComponent } from '../fall-leaves-animation/fall-leaves-animation.component';
import { SunSkyGradientComponent } from '../sun-sky-gradient/sun-sky-gradient.component';
import { WindowViewSkyService } from '../../services/window-view/window-view-sky.service';
import { WindowViewCompassColorsService } from '../../services/window-view/window-view-compass-colors.service';
import { WindowViewBrightnessDomService } from '../../services/window-view/window-view-brightness-dom.service';
import {
  applyAnimationTiming,
  assignGroundStackOrder,
  computeAltitudeTicks,
  computeDimSegments,
  filterMarkerPlanes,
  getMovementDirection,
  getSunElevationAngle,
  getSunGradientBottomPosition,
  getSunObject,
  injectCelestialMarkers,
  isDaytime,
} from '../../services/window-view/window-view-plane.util';
import type { WindowViewPlane } from '../../types/window-view-plane';

export type { WindowViewPlane };

@Component({
  selector: 'app-window-view-overlay',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    RainOverlayComponent,
    SkyBackgroundComponent,
    CelestialObjectsComponent,
    CompassLabelsComponent,
    AltitudeBandsComponent,
    MarkerLinesComponent,
    DimOverlayComponent,
    AircraftContainerComponent,
    SwallowAnimationComponent,
    FallLeavesAnimationComponent,
    SunSkyGradientComponent,
  ],
  templateUrl: './window-view-overlay.component.html',
  styleUrls: ['./window-view-overlay.component.scss'],
})
export class WindowViewOverlayComponent implements OnChanges, OnInit, OnDestroy {
  private prevXPositions = new Map<string, number>();
  private lastKnownDirections = new Map<string, 'left' | 'right'>();
  private subs: Subscription[] = [];

  @Input() highlightedPlaneIcao: string | null = null;
  @Input() windowViewPlanes: WindowViewPlane[] = [];
  @Input() observerLat!: number;
  @Input() observerLon!: number;
  @Input() isAtHome = false;
  @Input() showAltitudeBorders = false;
  @Input() animationsEnabled = true;
  @Input() windStat = 0;
  @Output() selectPlane = new EventEmitter<WindowViewPlane>();

  altitudeTicks: AltitudeTick[] = [];
  dimSegments: DimSegment[] = [];
  brightnessState: BrightnessState | null = null;
  stormDropIntensity = 0;
  isStormApproaching = false;

  constructor(
    private celestial: CelestialService,
    private altitudeColor: AltitudeColorService,
    private elRef: ElementRef,
    private scanService: ScanService,
    private stormPressureService: StormPressureService,
    private brightnessService: BrightnessService,
    public sky: WindowViewSkyService,
    public compass: WindowViewCompassColorsService,
    private brightnessDom: WindowViewBrightnessDomService
  ) {}

  @HostListener('document:contextmenu', ['$event'])
  preventContextMenu(event: MouseEvent): void {
    if (this.elRef.nativeElement.contains(event.target as Node)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  ngOnInit(): void {
    this.altitudeTicks = computeAltitudeTicks(20000, this.altitudeColor);
    this.syncAnimationTiming();
    this.subs.push(
      this.scanService.scanInterval$.subscribe(() => this.syncAnimationTiming()),
      this.stormPressureService.getStormAnalysis().subscribe((a) => {
        this.stormDropIntensity = a.dropIntensity;
        this.isStormApproaching = a.isStormApproaching;
      }),
      this.brightnessService.brightness$.subscribe((state) => {
        this.brightnessState = state;
        this.brightnessDom.applyBrightness(this.elRef, state);
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['windowViewPlanes'] ||
      changes['observerLat'] ||
      changes['observerLon']
    ) {
      this.windowViewPlanes = injectCelestialMarkers(
        this.windowViewPlanes,
        this.observerLat,
        this.observerLon,
        this.celestial
      );
      for (const plane of this.windowViewPlanes) {
        plane.movementDirection = getMovementDirection(
          plane,
          this.prevXPositions,
          this.lastKnownDirections
        );
        const prev = this.prevXPositions.get(plane.icao);
        plane.skipWrapTransition =
          prev !== undefined && Math.abs(plane.x - prev) > 50;
        this.prevXPositions.set(plane.icao, plane.x);
      }
      this.sky.updateWindowCloud(this.observerLat, this.observerLon);
      this.sky.updateWeather(
        this.observerLat,
        this.observerLon,
        this.windowViewPlanes,
        () => this.refreshCompass()
      );
      this.dimSegments = computeDimSegments(this.windowViewPlanes, this.isAtHome);
      this.refreshCompass();
      assignGroundStackOrder(this.windowViewPlanes);
      this.syncAnimationTiming();
    }
    if (changes['animationsEnabled']) {
      this.syncAnimationTiming();
    }
  }

  isDaytime = (): boolean => isDaytime(this.windowViewPlanes);
  getSunObject = (): WindowViewPlane | undefined => getSunObject(this.windowViewPlanes);
  getSunElevationAngle = (): number => getSunElevationAngle(this.windowViewPlanes);
  getSunGradientBottomPosition = (): string =>
    getSunGradientBottomPosition(this.windowViewPlanes);
  getMarkerPlanes = (): WindowViewPlane[] =>
    filterMarkerPlanes(this.windowViewPlanes, this.isAtHome);
  getCelestialObjects = (): WindowViewPlane[] =>
    this.windowViewPlanes.filter((p) => p.isCelestial);
  getAircraftPlanes = (): WindowViewPlane[] =>
    this.windowViewPlanes.filter((p) => !p.isMarker && !p.isCelestial);
  handlePlaneSelection = (plane: WindowViewPlane): void =>
    this.selectPlane.emit(plane);

  private refreshCompass(): void {
    this.compass.refresh(this.windowViewPlanes, this.sky.weatherCondition, null);
  }

  private syncAnimationTiming(): void {
    applyAnimationTiming(
      this.elRef.nativeElement as HTMLElement,
      this.scanService.scanInterval,
      this.animationsEnabled
    );
  }
}
