/* src/app/utils/plane-marker.ts */
import * as L from 'leaflet';
import { getIconPathForModel } from './plane-icons';
import { OperatorTooltipService } from '../services/operator-tooltip.service';
import SunCalc from 'suncalc';

// Smooth lerping animation function
function smoothLerpToPosition(
  marker: L.Marker,
  startLatLng: L.LatLng,
  endLatLng: L.LatLng,
  duration: number
): void {
  const startTime = Date.now();
  const startLat = startLatLng.lat;
  const startLng = startLatLng.lng;
  const endLat = endLatLng.lat;
  const endLng = endLatLng.lng; // Cubic-bezier easing function to match CSS transitions: cubic-bezier(0.25, 0.0, 0.25, 1.0)
  // This creates smooth acceleration and deceleration for natural movement
  const cubicBezier = (t: number): number => {
    // P0 = (0, 0), P1 = (0.25, 0), P2 = (0.25, 1), P3 = (1, 1)
    // Simplified cubic-bezier calculation for the specified control points
    return t * t * (3.0 - 2.0 * t); // Smoothstep function that approximates the cubic-bezier
  };
  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Linear interpolation for constant-speed movement
    const currentLat = startLat + (endLat - startLat) * progress;
    const currentLng = startLng + (endLng - startLng) * progress;
    marker.setLatLng([currentLat, currentLng]);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  // Start the animation
  requestAnimationFrame(animate);
}

// --- SHADOW CALCULATION ---
// Instead of a fixed offset, calculate the shadow direction based on the sun's azimuth and the plane's rotation.
// The shadow should be cast in the direction opposite to the sun, relative to the plane's heading.

// We can't inject services directly in a utility function, so we'll accept the helicopter check as a parameter
export function createOrUpdatePlaneMarker(
  oldMarker: L.Marker | undefined,
  map: L.Map,
  lat: number,
  lon: number,
  rotation: number,
  extraStyle: string,
  isNew: boolean,
  isGrounded: boolean,
  tooltipContent: string,
  planeIcon: string = '',
  isMilitary: boolean = false,
  model: string = '',
  isCustomHelicopter: boolean = false,
  isSpecial: boolean = false,
  isUnknown: boolean = false,
  altitude: number | null = null,
  followed: boolean = false,
  scanInterval: number = 10, // Scan interval in seconds for smooth transition timing
  icao: string = '', // ICAO identifier for debugging
  callsign: string = '', // Callsign for glider icon logic
  operatorTooltipService?: OperatorTooltipService, // Service for operator-specific tooltips
  planeData?: any // Complete plane data for operator checks
): { marker: L.Marker; isNewMarker: boolean } {
  // Use centralized helicopter identification via isCustomHelicopter parameter
  const isCopter = isCustomHelicopter;
  // Inline SVG for non-helicopters, CSS ::before for helicopters
  const iconData = isCopter
    ? { path: '', iconType: 'copter' as const }
    : getIconPathForModel(model, callsign, altitude || undefined);
  // Only render inline SVG for non-helicopters that are not unknown devices
  const iconInner =
    !isCopter && !isUnknown
      ? `<svg class="inline-plane ${iconData.iconType}" viewBox="0 0 64 64"><path d="${iconData.path}"/></svg>`
      : '';

  // --- Accurate shadow calculation ---
  // Get sun position at the marker's location
  const sunPos = SunCalc.getPosition(new Date(), lat, lon);
  // Convert SunCalc azimuth (from south, eastward) to map azimuth (from north, clockwise)
  const sunAzimuthMap = (sunPos.azimuth + Math.PI / 2) % (2 * Math.PI);
  // Plane rotation: degrees from north, clockwise. Convert to radians.
  const planeRotRad = ((isCopter ? 0 : rotation) * Math.PI) / 180;
  // Shadow direction: from plane toward the opposite of the sun's azimuth, relative to the plane's heading
  const shadowAngle = sunAzimuthMap + Math.PI - planeRotRad;
  // Shadow length: longer when sun is low, shorter when high
  const altMeters = altitude ?? 0;
  const sunAlt = sunPos.altitude;
  const baseLength = sunAlt > 0 ? Math.min(20, 10 / Math.tan(sunAlt)) : 0;
  const altFactor = Math.min(altMeters / 12000, 1);
  const length = baseLength * (1 + altFactor);
  // Shadow vector in marker's local coordinates
  const shadowDx = length * Math.cos(shadowAngle);
  const shadowDy = length * Math.sin(shadowAngle);
  // Only apply shadow for non-grounded planes
  const shadowStyle =
    !isGrounded && length > 0
      ? `filter: drop-shadow(${shadowDx.toFixed(1)}px ${shadowDy.toFixed(
          1
        )}px 1px rgba(0,0,1,0.6));`
      : '';

  // Build class list: non-helicopters get svg-plane to hide pseudo-icon
  // Only apply 'new-and-grounded' when plane is both new and grounded; no 'new-plane' CSS class
  const classString = `plane-marker ${
    !isCopter && !isUnknown ? 'svg-plane ' : ''
  }${!isCopter && !isUnknown ? iconData.iconType + ' ' : ''}${
    isNew && isGrounded
      ? 'new-and-grounded'
      : isGrounded
      ? 'grounded-plane'
      : ''
  } ${isMilitary ? 'military-plane' : ''} ${isCopter ? 'copter-plane' : ''}${
    isUnknown ? ' unknown-plane' : ''
  }${followed ? ' followed-plane' : ''}`;
  const markerHtml = `<div class="${classString}" style="transform: rotate(${
    isCopter ? 0 : rotation
  }deg); ${extraStyle} ${shadowStyle}">${iconInner}</div>`;

  // Let CSS handle container sizing: omit iconSize/iconAnchor to avoid inline styles
  const icon = L.divIcon({
    className: 'plane-marker-container',
    html: markerHtml,
  });

  // Get left tooltip content from operator service
  const leftTooltipContent =
    (operatorTooltipService as OperatorTooltipService | undefined) && planeData
      ? operatorTooltipService!.getLeftTooltipContent(planeData)
      : '&nbsp;';

  // Get additional operator classes
  const operatorClasses =
    operatorTooltipService && planeData
      ? operatorTooltipService.getTooltipClasses(planeData)
      : '';

  // Define tooltip options for RIGHT side (main tooltip with content)
  const rightTooltipOptions: L.TooltipOptions = {
    permanent: true,
    direction: 'right',
    offset: isGrounded ? L.point(-10, 0) : L.point(10, 0),
    interactive: true,
    className: `plane-tooltip ${isGrounded ? 'grounded-plane-tooltip' : ''} ${
      isNew ? 'new-plane-tooltip' : ''
    } ${isMilitary ? 'military-plane-tooltip' : ''} ${
      isSpecial ? 'special-plane-tooltip' : ''
    }${followed ? ' followed-plane-tooltip' : ''} ${operatorClasses}`,
    pane: 'tooltipPane',
  };

  // Define tooltip options for LEFT side (minimal/empty tooltip)
  const leftTooltipOptions: L.TooltipOptions = {
    permanent: true,
    direction: 'left',
    offset: isGrounded ? L.point(10, 0) : L.point(-10, 0),
    interactive: false,
    className: `plane-tooltip ${isGrounded ? 'grounded-plane-tooltip' : ''} ${
      isNew ? 'new-plane-tooltip' : ''
    } ${isMilitary ? 'military-plane-tooltip' : ''} ${
      isSpecial ? 'special-plane-tooltip' : ''
    }${followed ? ' followed-plane-tooltip' : ''} ${operatorClasses}`,
    pane: 'tooltipPane',
  }; // Helper function to manage bringing marker and tooltip to front
  const manageZIndex = (markerInstance: L.Marker, bringForward: boolean) => {
    const offset = bringForward ? 10000 : 0; // High offset for marker
    const tooltipZIndex = bringForward ? '20000' : ''; // Even higher z-index for tooltip

    markerInstance.setZIndexOffset(offset); // Affects marker's position within markerPane

    const tooltip = markerInstance.getTooltip();
    const tooltipEl = tooltip?.getElement();
    if (tooltipEl) {
      // Directly style the tooltip element to be above other panes/elements
      tooltipEl.style.zIndex = tooltipZIndex;
    }

    // Also manage left marker if it exists
    const leftMarker = (markerInstance as any).__leftMarker;
    if (leftMarker) {
      leftMarker.setZIndexOffset(offset);
      const leftTooltip = leftMarker.getTooltip();
      const leftTooltipEl = leftTooltip?.getElement();
      if (leftTooltipEl) {
        leftTooltipEl.style.zIndex = tooltipZIndex;
      }
    }
  };
  // Helper function to create a left marker with tooltip
  const createLeftMarker = (markerInstance: L.Marker) => {
    // Only create left marker if main marker is on the map
    if (!map.hasLayer(markerInstance)) {
      return null;
    }

    // Remove existing left marker if any
    removeLeftMarker(markerInstance);

    // Create invisible icon for left marker
    const invisibleIcon = L.divIcon({
      className: 'invisible-marker',
      html: '',
      iconSize: [1, 1],
    });

    // Create left marker at same position
    const leftMarker = L.marker(markerInstance.getLatLng(), {
      icon: invisibleIcon,
    });
    leftMarker.bindTooltip(leftTooltipContent, leftTooltipOptions);
    leftMarker.addTo(map);

    // Store reference
    (markerInstance as any).__leftMarker = leftMarker;

    // Sync position when main marker moves
    const syncPosition = () => {
      leftMarker.setLatLng(markerInstance.getLatLng());
    };
    markerInstance.on('move', syncPosition);
    (markerInstance as any).__syncLeftMarker = syncPosition;

    return leftMarker;
  };

  // Helper function to remove left marker
  const removeLeftMarker = (markerInstance: L.Marker) => {
    const leftMarker = (markerInstance as any).__leftMarker;
    const syncFn = (markerInstance as any).__syncLeftMarker;

    if (leftMarker) {
      map.removeLayer(leftMarker);
      delete (markerInstance as any).__leftMarker;
    }
    if (syncFn) {
      markerInstance.off('move', syncFn);
      delete (markerInstance as any).__syncLeftMarker;
    }
  };
  if (oldMarker) {
    // Get the current position for smooth interpolation
    const currentLatLng = oldMarker.getLatLng();
    const newLatLng = L.latLng(lat, lon);

    // Use a small threshold to detect meaningful position changes (about 0.1 meter precision)
    // Make this more sensitive to catch smaller movements
    const latDiff = Math.abs(currentLatLng.lat - lat);
    const lngDiff = Math.abs(currentLatLng.lng - lon);
    const hasPositionChanged = latDiff > 0.000001 || lngDiff > 0.000001;
    if (hasPositionChanged) {
      // Calculate animation duration: use 95% of scan interval for seamless movement
      // This matches the window view animation timing to prevent delays/pauses
      const animationDuration = Math.max(2, scanInterval * 0.95) * 1000; // Convert to milliseconds

      // Perform smooth lerping animation for all planes with position changes
      smoothLerpToPosition(
        oldMarker,
        currentLatLng,
        newLatLng,
        animationDuration
      );
    } else {
      // For planes that haven't moved significantly, update position immediately
      oldMarker.setLatLng([lat, lon]);
    }
    oldMarker.setIcon(icon);

    // Instead of recreating marker when pane changes, just update the z-index
    // This prevents interrupting ongoing animations
    if (followed) {
      // Bring followed planes to front
      oldMarker.setZIndexOffset(10000);
    } else {
      // Reset z-index for non-followed planes
      oldMarker.setZIndexOffset(0);
    } // Remove old tooltip and create a new one with updated classes/options
    if (oldMarker.getTooltip()) {
      oldMarker.unbindTooltip();
    }
    oldMarker.bindTooltip(tooltipContent, rightTooltipOptions);
    // Only retain left tooltip marker if there is content
    if (leftTooltipContent) {
      createLeftMarker(oldMarker);
    } else {
      removeLeftMarker(oldMarker);
    }

    // --- Set followed style immediately ---
    // if (followed) {
    //   const markerEl = oldMarker.getElement();
    //   if (markerEl) {
    //     // markerEl.style.borderColor = '#00ffff'; // Handled by SCSS
    //     // markerEl.style.color = '#00ffff'; // Handled by SCSS
    //   }
    //   const tooltipEl = oldMarker.getTooltip()?.getElement();
    //   if (tooltipEl) {
    //     // tooltipEl.style.borderColor = '#00ffff'; // Handled by SCSS
    //     // tooltipEl.style.color = '#00ffff'; // Handled by SCSS
    //   }
    // }

    // --- Event Handling for Existing Markers ---
    const bringForwardHandler = () => manageZIndex(oldMarker, true);
    const sendBackwardHandler = () => manageZIndex(oldMarker, false);

    // Remove previous listeners first
    oldMarker.off('mouseover');
    oldMarker.off('mouseout');
    oldMarker.off('tooltipopen');
    oldMarker.off('tooltipclose');

    // Add new marker listeners
    oldMarker.on('mouseover', bringForwardHandler);
    oldMarker.on('mouseout', sendBackwardHandler);

    // Add new tooltip listeners via tooltipopen/close
    oldMarker.on('tooltipopen', () => {
      const tooltipEl = oldMarker.getTooltip()?.getElement();
      if (tooltipEl) {
        tooltipEl.addEventListener('mouseenter', bringForwardHandler);
        tooltipEl.addEventListener('mouseleave', sendBackwardHandler);
        tooltipEl.addEventListener('click', (e: MouseEvent) => {
          // Ignore clicks on the callsign link itself
          if ((e.target as HTMLElement).closest('.callsign-text')) {
            return;
          }
          const wrapperEl = (e.target as HTMLElement).closest(
            '.tooltip-follow-wrapper'
          );
          if (!wrapperEl) return;
          e.stopPropagation();
          e.preventDefault();
          const icao = wrapperEl.getAttribute('data-icao');
          if (icao) {
            window.dispatchEvent(
              new CustomEvent('plane-tooltip-follow', { detail: { icao } })
            );
          }
        });
      }
    });
    oldMarker.on('tooltipclose', () => {
      const tooltipEl = oldMarker.getTooltip()?.getElement();
      if (tooltipEl) {
        tooltipEl.removeEventListener('mouseenter', bringForwardHandler);
        tooltipEl.removeEventListener('mouseleave', sendBackwardHandler);
      }
    });
    // --- End Event Handling ---

    return { marker: oldMarker, isNewMarker: false };
  } else {
    const marker = L.marker([lat, lon], { icon });
    marker.bindTooltip(tooltipContent, rightTooltipOptions);
    marker.addTo(map);

    // Only create left tooltip if content is non-empty
    if (leftTooltipContent) {
      createLeftMarker(marker);
    } else {
      // Ensure no leftover left marker exists
      removeLeftMarker(marker);
    }

    // --- Event Handling for New Markers ---
    const bringForwardHandler = () => manageZIndex(marker, true);
    const sendBackwardHandler = () => manageZIndex(marker, false);

    // Add marker listeners
    marker.on('mouseover', bringForwardHandler);
    marker.on('mouseout', sendBackwardHandler);

    // Add tooltip listeners via tooltipopen/close
    marker.on('tooltipopen', () => {
      const tooltipEl = marker.getTooltip()?.getElement();
      if (tooltipEl) {
        tooltipEl.addEventListener('mouseenter', bringForwardHandler);
        tooltipEl.addEventListener('mouseleave', sendBackwardHandler);
        tooltipEl.addEventListener('click', (e: MouseEvent) => {
          if ((e.target as HTMLElement).closest('.callsign-text')) {
            return;
          }
          const wrapperEl = (e.target as HTMLElement).closest(
            '.tooltip-follow-wrapper'
          );
          if (!wrapperEl) return;
          e.stopPropagation();
          e.preventDefault();
          const icao = wrapperEl.getAttribute('data-icao');
          if (icao) {
            window.dispatchEvent(
              new CustomEvent('plane-tooltip-follow', { detail: { icao } })
            );
          }
        });
      }
    });
    marker.on('tooltipclose', () => {
      const tooltipEl = marker.getTooltip()?.getElement();
      if (tooltipEl) {
        tooltipEl.removeEventListener('mouseenter', bringForwardHandler);
        tooltipEl.removeEventListener('mouseleave', sendBackwardHandler);
      }
    });
    // --- End Event Handling ---

    return { marker, isNewMarker: true };
  }
} // End of createOrUpdatePlaneMarker function

// Export function to clean up left markers for external use
export function removeLeftMarkerFromPlane(marker: L.Marker, map: L.Map): void {
  const leftMarker = (marker as any).__leftMarker;
  const syncFn = (marker as any).__syncLeftMarker;

  if (leftMarker) {
    map.removeLayer(leftMarker);
    delete (marker as any).__leftMarker;
  }

  if (syncFn) {
    marker.off('move', syncFn);
    delete (marker as any).__syncLeftMarker;
  }
}

// Helper to build marker options, adding custom pane when a marker is followed
function buildMarkerOptions(
  icon: L.DivIcon,
  followed: boolean
): L.MarkerOptions {
  const options: L.MarkerOptions = { icon };
  if (followed) {
    options.pane = 'followedMarkerPane';
  }
  return options;
}
