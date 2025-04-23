/* src/app/utils/plane-marker.ts */
import * as L from 'leaflet';

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
  isSpecial: boolean = false
): { marker: L.Marker; isNewMarker: boolean } {
  // Check if this is a helicopter based on model name or our custom list
  const modelLower = model.toLowerCase();
  const isCopter =
    isCustomHelicopter ||
    modelLower.includes('copter') ||
    modelLower.includes('helicopter') ||
    modelLower.includes('heli') ||
    modelLower.includes('chopper');

  const markerHtml = `<div class="plane-marker ${
    isNew && isGrounded
      ? 'new-and-grounded'
      : isNew
      ? 'new-plane'
      : isGrounded
      ? 'grounded-plane'
      : ''
  } ${isMilitary ? 'military-plane' : ''} ${
    isCopter ? 'copter-plane' : ''
  }" style="transform: rotate(${
    isCopter ? 0 : rotation + 90
  }deg); ${extraStyle}">${planeIcon}</div>`;

  const icon = L.divIcon({
    className: 'plane-marker-container',
    html: markerHtml,
    iconSize: [48, 48], // 3rem
    iconAnchor: [24, 24], // center
  });

  // Define tooltip options with the correct classes and ensure offset is a proper PointTuple
  const tooltipOptions: L.TooltipOptions = {
    permanent: true,
    direction: 'right',
    offset: isGrounded ? L.point(-10, 0) : L.point(10, 0),
    className: `plane-tooltip ${isGrounded ? 'grounded-plane-tooltip' : ''} ${
      isNew ? 'new-plane-tooltip' : ''
    } ${isMilitary ? 'military-plane-tooltip' : ''} ${
      isSpecial ? 'special-plane-tooltip' : ''
    }`,
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

    // Remove old tooltip and create a new one with updated classes/options
    if (oldMarker.getTooltip()) {
      oldMarker.unbindTooltip();
    }
    oldMarker.bindTooltip(tooltip, tooltipOptions);

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
