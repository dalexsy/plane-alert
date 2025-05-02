/* src/app/utils/plane-marker.ts */
import * as L from 'leaflet';
import { isHelicopter as checkIsHelicopter } from './svg-icons'; // Import the check function

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
  planeSvg: string, // Changed from planeIcon (string name) to planeSvg (SVG string)
  isMilitary: boolean = false,
  category: string = '', // Added category
  model: string = '',
  isCustomHelicopter: boolean = false,
  isSpecial: boolean = false,
  followed: boolean = false // <-- new param
): { marker: L.Marker; isNewMarker: boolean } {
  // Check if this is a helicopter using the imported utility function
  const isCopter = checkIsHelicopter(category, model, isCustomHelicopter);

  // Read UI scale factor from CSS
  const scaleFactor =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        '--scale-factor'
      )
    ) || 1;

  // Determine marker content based on whether it's a copter
  const markerContent = isCopter
    ? `<span class="material-symbols-outlined spinning-copter-icon">toys_fan</span>`
    : planeSvg;

  // Apply rotation only if it's not a copter
  const rotationStyle = isCopter ? '' : `transform: rotate(${rotation}deg);`;

  // Determine icon size and anchor based on type
  // Use consistent base size for all marker states to prevent recreation on status changes
  const baseSize = 48; // px
  const size = baseSize * scaleFactor;

  // FIXED: Always use the center of the icon as the anchor point
  // This ensures consistent positioning regardless of icon size or state changes
  const iconSize: L.PointTuple = [size, size];
  const iconAnchor: L.PointTuple = [size / 2, size / 2];

  // Compute tooltip offset based on scaled icon size
  const marginPx = 5; // small margin in px
  const offsetX = isGrounded ? -(size / 2 + marginPx) : size / 2 + marginPx;

  // Directly embed the SVG string or the mat-icon HTML into the marker HTML
  // IMPROVED: Added position:relative and overflow:visible to ensure proper centering
  const markerHtml = `<div class="plane-marker ${
    isNew && isGrounded
      ? 'new-and-grounded'
      : isNew
      ? 'new-plane'
      : isGrounded
      ? 'grounded-plane'
      : ''
  } ${isMilitary ? 'military-plane' : ''} ${
    followed ? ' followed-plane' : ''
  }" style="${rotationStyle} ${extraStyle} position:relative; overflow:visible;">${markerContent}</div>`;

  const icon = L.divIcon({
    className: `plane-marker-container ${
      isGrounded ? 'grounded-plane-container' : ''
    }`,
    html: markerHtml,
    iconSize: iconSize,
    iconAnchor: iconAnchor,
  });

  // Define tooltip options with the correct classes and ensure offset is a proper PointTuple
  const tooltipOptions: L.TooltipOptions = {
    permanent: true,
    direction: isGrounded ? 'left' : 'right',
    offset: L.point(offsetX, 0),
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

  // IMPROVED: Check if we can reuse the existing marker to avoid unnecessary recreation
  if (oldMarker) {
    // OPTIMIZED: Update marker properties without recreating it
    oldMarker.setLatLng([lat, lon]);
    oldMarker.setIcon(icon);

    // Check only if pane needs to change when follow status changes
    // FIXED: Only recreate marker if absolutely necessary (pane change)
    const oldPane = (oldMarker.options as any).pane;
    const desiredPane = followed ? 'followedMarkerPane' : undefined;

    // Only recreate marker if the pane needs to change (followed status toggle)
    if (oldPane !== desiredPane) {
      const wasOnMap = map.hasLayer(oldMarker);
      oldMarker.remove();

      // Create new marker with updated pane setting
      const newMarker = L.marker(
        [lat, lon],
        buildMarkerOptions(icon, followed)
      );
      newMarker.bindTooltip(tooltip, tooltipOptions);

      if (wasOnMap) newMarker.addTo(map);

      // Copy over follow styles and event handlers
      if (followed) {
        const el = newMarker.getElement();
        if (el) {
          el.style.borderColor = '#00ffff';
          el.style.color = '#00ffff';
        }
        const tel = newMarker.getTooltip()?.getElement();
        if (tel) {
          tel.style.borderColor = '#00ffff';
          tel.style.color = '#00ffff';
        }
      }

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
    if (followed) {
      const markerEl = oldMarker.getElement();
      if (markerEl) {
        markerEl.style.borderColor = '#00ffff';
        markerEl.style.color = '#00ffff';
      }
      const tooltipEl = oldMarker.getTooltip()?.getElement();
      if (tooltipEl) {
        tooltipEl.style.borderColor = '#00ffff';
        tooltipEl.style.color = '#00ffff';
      }
    }

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
    // Create a new marker
    const marker = L.marker([lat, lon], buildMarkerOptions(icon, followed));
    marker.bindTooltip(tooltip, tooltipOptions);
    marker.addTo(map);

    // --- Set followed style immediately ---
    if (followed) {
      const markerEl = marker.getElement();
      if (markerEl) {
        markerEl.style.borderColor = '#00ffff';
        markerEl.style.color = '#00ffff';
      }
      const tooltipEl = marker.getTooltip()?.getElement();
      if (tooltipEl) {
        tooltipEl.style.borderColor = '#00ffff';
        tooltipEl.style.color = '#00ffff';
      }
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
}

// Helper to build marker options, adding custom pane when a marker is followed
function buildMarkerOptions(
  icon: L.DivIcon,
  followed: boolean
): L.MarkerOptions {
  const options: L.MarkerOptions = { icon };
  if (followed) {
    options.pane = 'followedMarkerPane'; // Use a dedicated pane for followed markers
  }
  return options;
}
