// src/app/components/plane-list-item/plane-list-item.component.ts
import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  // Add HostBinding for dynamic classes
  HostBinding,
  HostListener,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlaneLogEntry } from '../results-overlay/results-overlay.component'; // Adjust path if needed
import { CountryService } from '../../services/country.service';
import { PlaneFilterService } from '../../services/plane-filter.service';
import { SettingsService } from '../../services/settings.service';
import { ButtonComponent } from '../ui/button.component'; // Assuming ButtonComponent is standalone
import { haversineDistance } from '../../utils/geo-utils';
import { PlaneStyleService } from '../../services/plane-style.service';
import { TtsService } from '../../services/tts.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-plane-list-item',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './plane-list-item.component.html',
  styleUrls: ['./plane-list-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush, // Use OnPush for performance
})
export class PlaneListItemComponent implements OnChanges {
  constructor(
    public countryService: CountryService,
    public planeFilter: PlaneFilterService,
    private settings: SettingsService,
    public planeStyle: PlaneStyleService, // Inject style service
    private tts: TtsService
  ) {}
  /** Distance from center, in km rounded to nearest tenth */
  get distanceKm(): number {
    const lat = this.settings.lat ?? 0;
    const lon = this.settings.lon ?? 0;
    if (this.plane.lat == null || this.plane.lon == null) return 0;
    return (
      Math.round(
        haversineDistance(lat, lon, this.plane.lat, this.plane.lon) * 10
      ) / 10
    );
  }

  @Input({ required: true }) plane!: PlaneLogEntry;
  // Reflect military/special state on host element for styling
  @HostBinding('class.military-plane') get hostMilitary() {
    return this.plane?.isMilitary === true;
  }
  @HostBinding('class.special-plane') get hostSpecial() {
    return this.plane?.isSpecial === true;
  }
  @HostBinding('class.new-plane') get hostNew() {
    return this.plane?.isNew === true;
  }
  @Input() highlightedPlaneIcao: string | null = null;
  @HostBinding('class.highlighted-plane')
  get hostHighlighted(): boolean {
    return this.plane.icao === this.highlightedPlaneIcao;
  }
  @Input() listType: 'sky' | 'airport' | 'seen' = 'sky'; // Default or require
  @Input() hoveredPlaneIcao: string | null = null; // For special icon hover
  @Input() now: number = Date.now();
  @Input() activePlaneIcaos: Set<string> = new Set();
  @Input() followedPlaneIcao: string | null = null;
  @Input() clickedAirports: Set<number> = new Set(); // Track clicked airports
  @Input() airportCircles: Map<number, L.Circle> = new Map(); // Airport circles for coordinate matching
  // Helper method to check if this plane's airport is clicked using airport badge logic
  isAirportClicked(): boolean {
    // Must have an airport name to be considered at an airport
    if (!this.plane.airportName) {
      return false;
    }

    // Must meet airport badge criteria: onGround OR altitude <= 200m
    const meetsAirportCriteria =
      this.plane.onGround === true ||
      (this.plane.altitude != null && this.plane.altitude <= 200);

    if (!meetsAirportCriteria) {
      return false;
    }

    // Must have clicked airports and coordinates to check
    if (
      !this.clickedAirports ||
      this.clickedAirports.size === 0 ||
      !this.airportCircles ||
      this.airportCircles.size === 0 ||
      this.plane.lat == null ||
      this.plane.lon == null
    ) {
      return false;
    }

    // Check if plane is within any clicked airport circle
    for (const [airportId, circle] of this.airportCircles) {
      if (this.clickedAirports.has(airportId)) {
        const airportCenter = circle.getLatLng();
        const airportRadius = circle.getRadius(); // in meters

        const distance =
          haversineDistance(
            this.plane.lat!,
            this.plane.lon!,
            airportCenter.lat,
            airportCenter.lng
          ) * 1000; // convert km to meters

        if (distance <= airportRadius) {
          return true;
        }
      }
    }

    return false;
  }
  @HostBinding('class.followed-plane')
  get hostFollowed(): boolean {
    return this.plane.icao === this.followedPlaneIcao;
  }

  @HostBinding('class.airport-clicked')
  get hostAirportClicked(): boolean {
    return this.isAirportClicked();
  }

  @HostBinding('class.faded-out')
  get hostFadedOut(): boolean {
    // Only fade out if not followed
    return (
      !this.activePlaneIcaos.has(this.plane.icao) &&
      this.plane.icao !== this.followedPlaneIcao
    );
  }

  @Output() centerPlane = new EventEmitter<PlaneLogEntry>();
  @Output() centerAirport = new EventEmitter<{ lat: number; lon: number }>();
  @Output() filterPrefix = new EventEmitter<PlaneLogEntry>();
  @Output() toggleSpecial = new EventEmitter<PlaneLogEntry>();
  @Output() hoverPlane = new EventEmitter<PlaneLogEntry>();
  @Output() unhoverPlane = new EventEmitter<PlaneLogEntry>();

  // Make the whole item clickable: clicking the host emits centerPlane
  @HostListener('click')
  onHostClick(): void {
    this.centerPlane.emit(this.plane);
  }

  // Keep hover/unhover in parent for simplicity for now

  // Keep getTimeAgo logic here as it's specific to the 'seen' variant display
  getTimeAgo(timestamp: number): string {
    const diff = Math.floor((this.now - timestamp) / 1000);
    const minutes = Math.floor(diff / 60);
    const hours = Math.floor(minutes / 60);
    if (diff < 60) return '<1m ago';
    if (minutes < 60) return `${minutes}m ago`;
    return `${hours}h ${minutes % 60}m ago`;
  }

  // --- Event Handlers ---
  onCenterPlane(event: Event): void {
    event.stopPropagation(); // Prevent triggering other clicks if nested
    this.centerPlane.emit(this.plane);
  }

  onCenterPlaneMouseEnter(): void {
    this.hoverPlane.emit(this.plane);
  }

  onCenterPlaneMouseLeave(): void {
    this.unhoverPlane.emit(this.plane);
  }

  onFilter(event: Event): void {
    event.stopPropagation();
    this.filterPrefix.emit(this.plane);
  }

  onToggleSpecial(event: Event): void {
    event.stopPropagation();
    this.toggleSpecial.emit(this.plane);
  }

  onCenterAirport(event: Event): void {
    event.stopPropagation();
    if (this.plane.airportLat != null && this.plane.airportLon != null) {
      this.centerAirport.emit({
        lat: this.plane.airportLat,
        lon: this.plane.airportLon,
      });
    }
  }
  ngOnChanges(changes: SimpleChanges): void {
    // Announce new planes at clicked airports only once per airport name
    if (this.plane.isNew && this.hostAirportClicked) {
      const airport = this.plane.airportName || 'Airport';
      // detect German words or umlauts to choose German locale
      const isGerman =
        /[äöüß]|flug|haupt|berlin|münchen|frankfurt|hamburg|düsseldorf|köln|stuttgart|hannover|nürnberg|dortmund|essen|bremen|dresden|leipzig/i.test(
          airport
        );
      const lang = isGerman ? 'de-DE' : navigator.language;

      // Preprocess text for better pronunciation
      const speakableText = this.preprocessForSpeech(airport, isGerman);

      // Debug log to see what's being spoken
      console.log('TTS Debug:', {
        original: airport,
        speakable: speakableText,
        language: lang,
        isGerman: isGerman,
      });

      this.tts.speakOnce(airport, speakableText, lang);
    }
  }

  /** Preprocess text for better text-to-speech pronunciation */
  private preprocessForSpeech(text: string, isGerman: boolean): string {
    if (!isGerman) return text;

    // Fix common German pronunciation issues
    return text;
  }
}
