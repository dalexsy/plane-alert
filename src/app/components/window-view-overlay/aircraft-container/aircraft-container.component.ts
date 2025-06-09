import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowViewPlane } from '../window-view-overlay.component';
import { AltitudeColorService } from '../../../services/altitude-color.service';
import { PlaneStyleService } from '../../../services/plane-style.service';
import { FlagCallsignComponent } from '../../flag-callsign/flag-callsign.component';
import { calculateTiltAngle } from '../../../utils/vertical-rate.util';

@Component({
  selector: 'app-aircraft-container',
  standalone: true,
  imports: [CommonModule, FlagCallsignComponent],
  templateUrl: './aircraft-container.component.html',
  styleUrl: './aircraft-container.component.scss',
})
export class AircraftContainerComponent {
  @Input() aircraftPlanes: WindowViewPlane[] = [];
  @Input() highlightedPlaneIcao: string | null = null;
  @Output() selectPlane = new EventEmitter<WindowViewPlane>();

  constructor(
    public altitudeColor: AltitudeColorService,
    public planeStyle: PlaneStyleService
  ) {}

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
    }

    // Final fallback: No rotation (nose pointing up)
    return 'rotateZ(0deg)';
  }
}
