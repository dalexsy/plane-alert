import * as L from 'leaflet';

/** Onion-skin ghost at previous ADS-B fix while the main icon animates. */
export function updateGhostMarker(
  mainMarker: L.Marker,
  map: L.Map,
  lat: number,
  lon: number,
  showGhost: boolean,
  animationsActive: boolean,
  ghostMarkerHtml: string
): void {
  const shouldShow = showGhost && animationsActive;
  const existing: L.Marker | undefined = (mainMarker as any).__paGhostMarker;
  if (!shouldShow) {
    if (existing) {
      map.removeLayer(existing);
      delete (mainMarker as any).__paGhostMarker;
    }
    return;
  }
  const ghostIcon = L.divIcon({
    className: 'plane-marker-container ghost-position-marker',
    html: ghostMarkerHtml,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
  if (existing) {
    existing.setLatLng([lat, lon]);
    existing.setIcon(ghostIcon);
  } else {
    const ghost = L.marker([lat, lon], { icon: ghostIcon, interactive: false });
    ghost.addTo(map);
    (mainMarker as any).__paGhostMarker = ghost;
  }
}

export function removeGhostMarkerFromPlane(marker: L.Marker, map: L.Map): void {
  const ghostMarker = (marker as any).__paGhostMarker as L.Marker | undefined;
  if (ghostMarker) {
    map.removeLayer(ghostMarker);
    delete (marker as any).__paGhostMarker;
  }
}
