import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowViewPlane } from '../window-view-overlay.component';
import { AltitudeColorService } from '../../../services/altitude-color.service';
import { PlaneStyleService } from '../../../services/plane-style.service';
import { FlagCallsignComponent } from '../../flag-callsign/flag-callsign.component';
import { calculateTiltAngle } from '../../../utils/vertical-rate.util';
import { TextUtils } from '../../../utils/text-utils';
import { OperatorTooltipService } from '../../../services/operator-tooltip.service';

@Component({
  selector: 'app-aircraft-container',
  standalone: true,
  imports: [CommonModule, FlagCallsignComponent],
  templateUrl: './aircraft-container.component.html',
  styleUrl: './aircraft-container.component.scss',
})
export class AircraftContainerComponent implements OnChanges {
  @Input() aircraftPlanes: WindowViewPlane[] = [];
  @Input() highlightedPlaneIcao: string | null = null;
  @Input() showAltitudeBorders: boolean = false;
  @Input() skyBottomColor: string = 'rgb(135, 206, 235)'; // Default horizon color
  @Input() skyTopColor: string = 'rgb(25, 25, 112)'; // Default zenith color
  @Output() selectPlane = new EventEmitter<WindowViewPlane>();
  // Cache for altitude border styles to avoid recalculation
  private altitudeBorderCache = new Map<string, { [key: string]: string }>();
  private labelClassCache = new Map<string, string>();
  private readonly MAX_CACHE_SIZE = 1000; // Prevent memory leaks

  constructor(
    public altitudeColor: AltitudeColorService,
    public planeStyle: PlaneStyleService,
    public operatorTooltipService: OperatorTooltipService
  ) {
    // Expose debug function to window for console debugging
    if (typeof window !== 'undefined') {
      (window as any).debugClosePlanes = () => this.debugClosePlanes();
    }
  }
  ngOnChanges(changes: SimpleChanges): void {
    // Clear caches when showAltitudeBorders changes or when planes data changes
    if (changes['showAltitudeBorders'] || changes['aircraftPlanes']) {
      this.clearCaches();
    }
  } /** Clear all caches - useful when settings change */
  private clearCaches(): void {
    this.altitudeBorderCache.clear();
    this.labelClassCache.clear();
  }

  /** Manage cache size to prevent memory leaks */
  private manageCacheSize<K, V>(cache: Map<K, V>): void {
    if (cache.size > this.MAX_CACHE_SIZE) {
      // Remove oldest entries (first 20% of cache)
      const entriesToRemove = Math.floor(this.MAX_CACHE_SIZE * 0.2);
      const keys = Array.from(cache.keys());
      for (let i = 0; i < entriesToRemove; i++) {
        cache.delete(keys[i]);
      }
    }
  }

  /** TrackBy function to prevent unnecessary DOM re-creation during animations */
  trackByPlaneIcao(index: number, plane: WindowViewPlane): string {
    return plane.icao || plane.callsign || `${index}`;
  }

  /** Emit selection event when user clicks a plane label */
  handleLabelClick(plane: WindowViewPlane, event: MouseEvent): void {
    event.stopPropagation();
    this.selectPlane.emit(plane);
  } /** Debug function to log plane data when clicking on plane icon */
  handlePlaneIconClick(plane: WindowViewPlane, event: MouseEvent): void {
    event.stopPropagation();

    // Debug the has-details logic for planes within 10km
    if (plane.distanceKm != null && plane.distanceKm <= 10) {
      console.log(`🛩️ Plane ${plane.callsign} (${plane.icao}) details:`, {
        distanceKm: plane.distanceKm,
        operator: plane.operator,
        model: plane.model,
        isGrounded: plane.isGrounded,
        hasOperatorOrModel: !!(plane.operator || plane.model),
        shouldHaveDetails:
          plane.distanceKm != null &&
          plane.distanceKm <= 10 &&
          (plane.operator || plane.model) &&
          !plane.isGrounded,
        labelClasses: this.getLabelClasses(plane),
      });
    }

    // Show trail positions to see actual movement
    if (plane.historyTrail && plane.historyTrail.length > 1) {
      plane.historyTrail
        .slice()
        .reverse()
        .forEach((pos, i) => {
          const valid = pos.y > 0.1 && pos.x >= 0 && pos.x <= 100;
        });

      // Calculate movement from trail using validation logic
      if (plane.historyTrail.length >= 2) {
        const current = plane.historyTrail[plane.historyTrail.length - 1];
        let previous: any = null;

        // Find valid previous position
        for (let i = plane.historyTrail.length - 2; i >= 0; i--) {
          const candidate = plane.historyTrail[i];
          if (candidate.y > 0.1 && candidate.x >= 0 && candidate.x <= 100) {
            previous = candidate;

            break;
          }
        }

        if (previous && current.y > 0.1 && current.x >= 0 && current.x <= 100) {
          let deltaX = current.x - previous.x;
          let deltaY = current.y - previous.y;

          // Handle wrap-around
          if (deltaX > 50) {
            deltaX -= 100;
          } else if (deltaX < -50) {
            deltaX += 100;
          }

          const calculatedDirection = deltaX > 0 ? 'right' : 'left';

          // Calculate and log the full movement angle for both horizontal and vertical movement
          if (Math.abs(deltaX) > 0.05 || Math.abs(deltaY) > 0.05) {
            let movementAngle = Math.atan2(-deltaY, deltaX) * (180 / Math.PI); // Invert Y for screen coords
            let normalizedMovementAngle = ((movementAngle % 360) + 360) % 360; // Normalize to 0-360
            let iconAngle =
              (((normalizedMovementAngle + 90) % 360) + 360) % 360; // Add 90° and normalize again
          } else {
          }
        } else {
        }
      }
    }
    // Also log some other planes for comparison

    this.aircraftPlanes
      .filter((p) => !p.isMarker && !p.isCelestial)
      .slice(0, 5)
      .forEach((p) => {
        const rotation = this.getIconRotation(p);
        const bearing =
          p.bearing !== undefined ? `${p.bearing.toFixed(0)}°` : 'N/A';
      });

    console.groupEnd();

    // Also emit selection event
    this.selectPlane.emit(plane);
  }

  /** Apply perspective transform with vanishing point at bottom center */
  getPerspectiveTransform(plane: WindowViewPlane): string {
    // For grounded planes, keep the existing ground effect
    if (plane.isGrounded) {
      return `perspective(300px) rotateX(60deg) rotateY(-0deg) rotateZ(90deg)`;
    }

    // Create perspective effect with vanishing point at bottom center
    // Higher altitudes get more perspective tilt to simulate distance
    const maxAltitude = 20000; // Max altitude in meters for scaling
    const altitude = Math.max(plane.altitude || 1000, 100); // Ensure minimum altitude for perspective
    const clampedAltitude = Math.min(altitude, maxAltitude);

    // Calculate perspective tilt based on altitude (10° to 60° for better visibility)
    // Even low altitude planes need some perspective to show depth
    const minTilt = 10; // Minimum tilt angle for low planes
    const maxTilt = 60; // Maximum tilt angle for high planes
    const tiltAngle =
      minTilt +
      ((clampedAltitude - 100) / (maxAltitude - 100)) * (maxTilt - minTilt);

    // Calculate distance from center for additional perspective scaling
    // Planes further from center (left/right) get slightly more perspective
    const centerX = 50; // Center is at 50%
    const distanceFromCenter = Math.abs(plane.x - centerX) / 50; // 0-1 scale
    const lateralPerspective = distanceFromCenter * 10; // Up to 10° additional tilt

    // Combine altitude and lateral perspective
    const totalTilt = tiltAngle + lateralPerspective;

    // Apply perspective with proper depth and rotation
    // Use a closer perspective distance for more dramatic effect
    return `perspective(400px) rotateX(${totalTilt}deg)`;
  } /** Return CSS rotateZ transform showing aircraft direction from window observer's perspective */
  getIconRotation(plane: WindowViewPlane): string {
    // Primary approach: Calculate visual movement direction from trail data
    // This shows how the plane appears to move across the window, not its compass bearing

    if (plane.historyTrail && plane.historyTrail.length >= 2) {
      // Find the most recent valid trail positions
      let current = plane.historyTrail[plane.historyTrail.length - 1];
      let previous: any = null;

      // Look backwards through trail to find a valid previous position
      for (let i = plane.historyTrail.length - 2; i >= 0; i--) {
        const candidate = plane.historyTrail[i];
        // Skip positions with invalid coordinates (y=0 indicates corrupt data)
        if (candidate.y > 0.1 && candidate.x >= 0 && candidate.x <= 100) {
          previous = candidate;
          break;
        }
      }

      // Only proceed if we have both valid current and previous positions
      if (previous && current.y > 0.1 && current.x >= 0 && current.x <= 100) {
        let deltaX = current.x - previous.x;
        let deltaY = current.y - previous.y;

        // Handle wrap-around for X coordinate in window view (0-100% wraps around)
        if (deltaX > 50) {
          deltaX -= 100;
        } else if (deltaX < -50) {
          deltaX += 100;
        }

        // Calculate visual movement direction in window coordinates
        // deltaX: positive = moving right, negative = moving left
        // deltaY: positive = moving down (further from observer), negative = moving up (closer to observer)
        // Check if there's significant movement to calculate direction
        if (Math.abs(deltaX) > 0.05 || Math.abs(deltaY) > 0.05) {
          // Calculate the angle of movement using atan2
          // Invert deltaY because screen Y increases downward, but window coordinates Y increases upward
          let movementAngle = Math.atan2(-deltaY, deltaX) * (180 / Math.PI);

          // Convert to 0-360 range
          movementAngle = ((movementAngle % 360) + 360) % 360;

          // Adjust for SVG icon default orientation (nose points UP)
          // The SVG nose pointing UP corresponds to 0°, so we add 90° to align with movement direction
          let iconRotation = (movementAngle + 90) % 360;

          return `rotateZ(${iconRotation.toFixed(1)}deg)`;
        }
      }
    }

    // Fallback: Use simple movement direction if available
    if (plane.movementDirection) {
      const rotationMap: { [key: string]: number } = {
        left: 270, // Nose pointing left
        right: 90, // Nose pointing right
        up: 0, // Nose pointing up (default SVG orientation)
        down: 180, // Nose pointing down
      };

      const rotation = rotationMap[plane.movementDirection] || 0;
      return `rotateZ(${rotation}deg)`;
    } // Final fallback: No rotation (nose pointing up)
    return 'rotateZ(0deg)';
  } /** Get chemtrail rotation based on plane movement direction - trails behind the plane */
  getChemtrailRotation(plane: WindowViewPlane): string {
    // Skip chemtrails for markers, helicopters, grounded planes, and celestial objects
    if (
      plane.isMarker ||
      plane.isHelicopter ||
      plane.isGrounded ||
      plane.isCelestial
    ) {
      return '';
    }

    // Only show chemtrails at altitudes where contrails can form
    // Contrails typically form above 26,000 feet (8,000 meters)
    const minContrailAltitude = 8000; // meters
    if (!plane.altitude || plane.altitude < minContrailAltitude) {
      return ''; // No rotation needed if no chemtrail is shown
    }

    // ALWAYS recalculate - no caching to ensure fresh updates every scan interval

    // Use the EXACT same movement calculation as the plane icon, then rotate 180° opposite
    const iconRotation = this.getIconRotation(plane);
    // Extract the angle from the icon rotation string (e.g., "rotateZ(45.0deg)" -> 45.0)
    const match = iconRotation.match(/rotateZ\((-?\d+(?:\.\d+)?)deg\)/);
    if (match) {
      const iconAngle = parseFloat(match[1]);
      // Rotate chemtrail 90° from the plane icon direction
      const chemtrailAngle = (iconAngle + 90) % 360;
      return `rotate(${chemtrailAngle.toFixed(1)}deg)`;
    }

    // Improved fallback: Use bearing data if available (most planes have this even when new)
    if (plane.bearing !== undefined && plane.bearing !== null) {
      // Convert compass bearing to chemtrail rotation
      // Bearing 0° = North, 90° = East, 180° = South, 270° = West
      // For chemtrail, we want it to point opposite to the direction of travel
      let trailRotation = (plane.bearing + 180) % 360;
      return `rotate(${trailRotation.toFixed(1)}deg)`;
    }

    // Secondary fallback: Use simple movement direction if available
    if (plane.movementDirection) {
      const rotationMap: { [key: string]: number } = {
        left: 90, // Trail points right when plane moves left
        right: 270, // Trail points left when plane moves right
        up: 180, // Trail points down when plane moves up
        down: 0, // Trail points up when plane moves down
      };
      const rotation = rotationMap[plane.movementDirection] || 180;
      return `rotate(${rotation}deg)`;
    }

    // Final fallback: Trail points down (assuming plane moving up)
    return 'rotate(180deg)';
  }

  /** Fallback method for chemtrail rotation when trail data is unavailable */
  private getChemtrailFallback(plane: WindowViewPlane): string {
    // Fallback method: Use compass bearing for immediate directional chemtrails
    // This provides correct rotation for new planes before history trail data accumulates
    if (plane.bearing !== undefined && plane.bearing !== null) {
      // Convert compass bearing to chemtrail rotation
      // Bearing 0° = North, 90° = East, 180° = South, 270° = West
      // For chemtrail, we want it to point opposite to the direction of travel
      let trailRotation = (plane.bearing + 180) % 360;
      return `rotate(${trailRotation.toFixed(1)}deg)`;
    }

    // Secondary fallback: Use simple movement direction if available
    if (plane.movementDirection) {
      const rotationMap: { [key: string]: number } = {
        left: 90, // Trail points right when plane moves left
        right: 270, // Trail points left when plane moves right
        up: 180, // Trail points down when plane moves up
        down: 0, // Trail points up when plane moves down
      };
      const rotation = rotationMap[plane.movementDirection] || 180;
      return `rotate(${rotation}deg)`;
    }

    // Final fallback: Trail points down (plane moving up)
    return 'rotate(180deg)';
  } /** Get altitude-colored border style for window view tooltips */
  getAltitudeBorderStyle(plane: WindowViewPlane): { [key: string]: string } {
    // Quick return if altitude borders are disabled
    if (!this.showAltitudeBorders || !plane.altitude) {
      return {};
    }

    // Create cache key based on plane ICAO and altitude
    const cacheKey = `${plane.icao}-${plane.altitude}`;

    // Return cached result if available
    if (this.altitudeBorderCache.has(cacheKey)) {
      return this.altitudeBorderCache.get(cacheKey)!;
    }

    const altitudeColor = this.altitudeColor.getFillColor(plane.altitude);
    const result = { 'border-color': altitudeColor }; // Cache the result
    this.altitudeBorderCache.set(cacheKey, result);
    this.manageCacheSize(this.altitudeBorderCache);
    return result;
  }

  /** Get CSS classes for plane labels including altitude border class */ getLabelClasses(
    plane: WindowViewPlane
  ): string {
    // Create a more efficient cache key using only the essential properties
    const hasDetails =
      plane.distanceKm != null &&
      plane.distanceKm <= 10 &&
      !plane.isGrounded &&
      // Show tooltip style if: has operator/model data OR is very close (within 3km)
      (plane.operator || plane.model || plane.distanceKm <= 3);
    const isFollowed = plane.icao === this.highlightedPlaneIcao;
    const hasAltitudeBorder =
      hasDetails && this.showAltitudeBorders && plane.altitude;
    const cacheKey = `${plane.icao}-${isFollowed}-${hasDetails}-${hasAltitudeBorder}`;

    // Return cached result if available
    if (this.labelClassCache.has(cacheKey)) {
      return this.labelClassCache.get(cacheKey)!;
    }

    const classes = [];

    if (isFollowed) {
      classes.push('followed');
    }

    if (hasDetails) {
      classes.push('has-details');

      if (hasAltitudeBorder) {
        classes.push('altitude-bordered-tooltip');
      }
    }

    const result = classes.join(' ');
    // Cache the result
    this.labelClassCache.set(cacheKey, result);
    this.manageCacheSize(this.labelClassCache);
    return result;
  }
  /**
   * Truncate operator text to 30 characters with ellipsis if longer
   */
  truncateOperator(operator: string | undefined): string {
    return TextUtils.truncateOperator(operator);
  }
  /** Calculate chemtrail scale based on plane velocity - faster planes get longer trails */
  getChemtrailScale(plane: WindowViewPlane): number {
    // Skip scaling for markers, helicopters, grounded planes, and celestial objects
    if (
      plane.isMarker ||
      plane.isHelicopter ||
      plane.isGrounded ||
      plane.isCelestial
    ) {
      return 0; // No chemtrails for these types
    }

    // Only show chemtrails at altitudes where contrails can form
    // Contrails typically form above 26,000 feet (8,000 meters)
    const minContrailAltitude = 8000; // meters
    if (!plane.altitude || plane.altitude < minContrailAltitude) {
      return 0; // Hide chemtrails below contrail formation altitude
    }

    // If no velocity data, use default scale
    if (!plane.velocity || plane.velocity <= 0) {
      return 1;
    }

    // Scale based on velocity (ground speed in knots)
    // Typical aircraft speeds:
    // - Small aircraft: 100-200 knots
    // - Commercial aircraft: 400-600 knots
    // - Fast military jets: 600+ knots

    const minVelocity = 50; // Minimum velocity for scaling (knots)
    const maxVelocity = 600; // Maximum velocity for full scaling (knots)
    const minScale = 0.1; // Minimum scale factor
    const maxScale = 1; // Maximum scale factor

    // Clamp velocity to range
    const clampedVelocity = Math.max(
      minVelocity,
      Math.min(maxVelocity, plane.velocity)
    );

    // Calculate linear scale factor
    const normalizedVelocity =
      (clampedVelocity - minVelocity) / (maxVelocity - minVelocity);
    const scale = minScale + normalizedVelocity * (maxScale - minScale);

    return Math.round(scale * 100) / 100; // Round to 2 decimal places
  }

  /** Calculate 3D depth positioning to ensure proper layering without z-index conflicts */
  get3DDepthTransform(plane: WindowViewPlane): string {
    // For markers and celestial objects, use minimal depth
    if (plane.isMarker || plane.isCelestial) {
      return 'translateZ(0px)';
    }

    // Use both altitude and distance to calculate depth
    // Higher altitude = further back in 3D space
    // Greater distance = further back in 3D space

    const maxAltitude = 20000; // meters
    const maxDistance = 100; // km

    // Calculate altitude component (0-1 scale)
    const altitudeNormalized = Math.min((plane.altitude || 0) / maxAltitude, 1);

    // Calculate distance component (0-1 scale)
    const distanceNormalized = Math.min(
      (plane.distanceKm || 0) / maxDistance,
      1
    );

    // Combine altitude and distance for depth calculation
    // Weight altitude more heavily as it's more visually important
    const combinedDepth = altitudeNormalized * 0.7 + distanceNormalized * 0.3;

    // Map to translateZ range: 0px (front) to -500px (back)
    // Negative values move objects away from viewer
    const depthPx = -combinedDepth * 500;

    // Special cases for grounded planes and close aircraft
    if (plane.isGrounded) {
      return 'translateZ(-10px)'; // Just slightly behind to avoid overlap
    }

    if (plane.distanceKm != null && plane.distanceKm <= 10) {
      // Close planes get priority positioning (closer to viewer)
      return `translateZ(${Math.max(depthPx * 0.3, -100)}px)`;
    }
    return `translateZ(${depthPx}px)`;
  } /** Calculate atmospheric perspective effects for distant planes */
  getAtmosphericPerspective(plane: WindowViewPlane): number {
    // Skip atmospheric effects for markers and celestial objects
    if (plane.isMarker || plane.isCelestial) {
      return 1;
    }

    // Calculate distance factor (0 = close, 1 = very distant)
    const maxDistance = 70; // km - beyond this distance, maximum atmospheric effect
    const distanceFactor = Math.min((plane.distanceKm || 0) / maxDistance, 1);

    // Calculate altitude factor (higher altitude = more atmospheric scattering)
    const maxAltitude = 20000; // meters
    const altitudeFactor = Math.min((plane.altitude || 0) / maxAltitude, 1);

    // Combine distance and altitude for atmospheric intensity
    // Distance has more impact than altitude for atmospheric perspective
    const atmosphericIntensity = distanceFactor * 0.8 + altitudeFactor * 0.2;

    // Return opacity: close planes = 1.0, distant planes fade to 0.3
    return Math.max(0.1, 1 - atmosphericIntensity * 0.7);
  }

  /**
   * Get operator logo content for window view tooltip
   */
  getOperatorLogoContent(plane: WindowViewPlane): string {
    // Convert plane to the format expected by OperatorTooltipService
    const planeData = {
      isMilitary: plane.isMilitary,
      country: plane.origin?.toLowerCase(), // origin is used as country in window view
    };

    return this.operatorTooltipService.getLeftTooltipContent(planeData);
  }

  /**
   * Check if plane should show operator logo tooltip
   */
  shouldShowOperatorLogo(plane: WindowViewPlane): boolean {
    return !!(
      plane.isMilitary &&
      plane.origin &&
      this.getOperatorLogoContent(plane)
    );
  }

  /** Debug function to analyze planes within 10km */
  debugClosePlanes(): void {
    const closePlanes = this.aircraftPlanes.filter(
      (plane) =>
        plane.distanceKm != null &&
        plane.distanceKm <= 10 &&
        !plane.isMarker &&
        !plane.isCelestial
    );

    console.log(`🛩️ Found ${closePlanes.length} planes within 10km:`);
    closePlanes.forEach((plane) => {
      const hasDetails =
        plane.distanceKm != null &&
        plane.distanceKm <= 10 &&
        !plane.isGrounded &&
        (plane.operator || plane.model || plane.distanceKm <= 3);

      console.log(`  ${plane.callsign} (${plane.icao}):`, {
        distance: `${plane.distanceKm?.toFixed(1)}km`,
        operator: plane.operator || 'none',
        model: plane.model || 'none',
        grounded: plane.isGrounded,
        hasDetails: hasDetails,
        classes: this.getLabelClasses(plane),
      });
    });
  }
}
