/* src/app/utils/plane-marker.ts */
import * as L from 'leaflet';
import { getIconPathForModel } from './plane-icons';
import SunCalc from 'suncalc';

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
  tooltip: string,
  planeIcon: string = '',
  isMilitary: boolean = false,
  model: string = '',
  isCustomHelicopter: boolean = false,
  isSpecial: boolean = false,
  altitude: number | null = null,
  followed: boolean = false
): { marker: L.Marker; isNewMarker: boolean } {
  // Check if this is a helicopter based on model name or our custom list
  const modelLower = model.toLowerCase();
  const isCopter =
    isCustomHelicopter ||
    modelLower.includes('copter') ||
    modelLower.includes('helicopter') ||
    modelLower.includes('heli') ||
    modelLower.includes('chopper');

  // Inline SVG for non-helicopters, CSS ::before for helicopters
  const iconData = isCopter
    ? { path: '', iconType: 'copter' as const }
    : getIconPathForModel(model);
  // Only render SVG for non-helicopters
  const iconInner = !isCopter
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
      ? `filter: drop-shadow(${shadowDx.toFixed(1)}px ${shadowDy.toFixed(1)}px 1px rgba(0,0,1,0.6));`
      : '';

  // Build class list: non-helicopters get svg-plane to hide pseudo-icon
  // Only apply 'new-and-grounded' when plane is both new and grounded; no 'new-plane' CSS class
  const classString = `plane-marker ${!isCopter ? 'svg-plane ' : ''}${
    !isCopter ? iconData.iconType + ' ' : ''
  }${
    isNew && isGrounded
      ? 'new-and-grounded'
      : isGrounded
      ? 'grounded-plane'
      : ''
  } ${isMilitary ? 'military-plane' : ''} ${isCopter ? 'copter-plane' : ''}${
    followed ? ' followed-plane' : ''
  }`;
  const markerHtml = `<div class="${classString}" style="transform: rotate(${
    isCopter ? 0 : rotation
  }deg); ${extraStyle} ${shadowStyle}">${iconInner}</div>`;

  // Let CSS handle container sizing: omit iconSize/iconAnchor to avoid inline styles
  const icon = L.divIcon({
    className: 'plane-marker-container',
    html: markerHtml,
  });

  // Define tooltip options with the correct classes and ensure offset is a proper PointTuple
  const tooltipOptions: L.TooltipOptions = {
    permanent: true,
    direction: 'right',
    offset: isGrounded ? L.point(-10, 0) : L.point(10, 0),
    interactive: true, // enable pointer events on tooltip
    className: `plane-tooltip ${isGrounded ? 'grounded-plane-tooltip' : ''} ${
      isNew ? 'new-plane-tooltip' : ''
    } ${isMilitary ? 'military-plane-tooltip' : ''} ${
      isSpecial ? 'special-plane-tooltip' : ''
    }${followed ? ' followed-plane-tooltip' : ''}`,
    pane: 'tooltipPane', // Ensure tooltip is in the tooltipPane (typically above markerPane)
  };

  // Helper function to manage bringing marker and tooltip to front
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
  };

  if (oldMarker) {
    oldMarker.setLatLng([lat, lon]);
    oldMarker.setIcon(icon);

    // Recreate marker if pane needs to change when follow status toggles
    const oldPane = (oldMarker.options as any).pane;
    const desiredPane = followed ? 'followedMarkerPane' : undefined;
    if (oldPane !== desiredPane) {
      const wasOnMap = map.hasLayer(oldMarker);
      oldMarker.remove();
      const newMarker = L.marker(
        [lat, lon],
        buildMarkerOptions(icon, followed)
      );
      newMarker.bindTooltip(tooltip, tooltipOptions);
      if (wasOnMap) newMarker.addTo(map);
      // Event handlers will be re-attached
      const bring = () => manageZIndex(newMarker, true);
      const send = () => manageZIndex(newMarker, false);
      newMarker.on('mouseover', bring);
      newMarker.on('mouseout', send);
      newMarker.on('tooltipopen', () => {
        const tel = newMarker.getTooltip()?.getElement();
        if (tel) {
          tel.addEventListener('mouseenter', bring);
          tel.addEventListener('mouseleave', send);
          tel.addEventListener('click', (e: MouseEvent) => {
            // Ignore clicks on the callsign (handled by tooltip onclick)
            if ((e.target as HTMLElement).closest('.callsign-text')) {
              return;
            }
            const w = (e.target as HTMLElement).closest(
              '.tooltip-follow-wrapper'
            );
            if (!w) return;
            e.stopPropagation();
            e.preventDefault();
            const icao = w.getAttribute('data-icao');
            if (icao)
              window.dispatchEvent(
                new CustomEvent('plane-tooltip-follow', { detail: { icao } })
              );
          });
        }
      });
      newMarker.on('tooltipclose', () => {
        const tel = newMarker.getTooltip()?.getElement();
        if (tel) {
          tel.removeEventListener('mouseenter', bring);
          tel.removeEventListener('mouseleave', send);
        }
      });
      return { marker: newMarker, isNewMarker: true };
    }

    // Remove old tooltip and create a new one with updated classes/options
    if (oldMarker.getTooltip()) {
      oldMarker.unbindTooltip();
    }
    oldMarker.bindTooltip(tooltip, tooltipOptions);

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
    marker.bindTooltip(tooltip, tooltipOptions);
    marker.addTo(map);

    // --- Set followed style immediately ---
    // if (followed) {
    //   const markerEl = marker.getElement();
    //   if (markerEl) {
    //     // markerEl.style.borderColor = '#00ffff'; // Handled by SCSS
    //     // markerEl.style.color = '#00ffff'; // Handled by SCSS
    //   }
    //   const tooltipEl = marker.getTooltip()?.getElement();
    //   if (tooltipEl) {
    //     // tooltipEl.style.borderColor = '#00ffff'; // Handled by SCSS
    //     // tooltipEl.style.color = '#00ffff'; // Handled by SCSS
    //   }
    // }

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
