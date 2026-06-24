function cubicBezierStep(t: number): number {
  return t * t * (3.0 - 2.0 * t);
}

export function smoothLerpMarkerToPosition(
  marker: L.Marker,
  startLatLng: L.LatLng,
  endLatLng: L.LatLng,
  duration: number
): void {
  const startTime = Date.now();
  const startLat = startLatLng.lat;
  const startLng = startLatLng.lng;
  const endLat = endLatLng.lat;
  const endLng = endLatLng.lng;

  const animate = () => {
    const progress = Math.min((Date.now() - startTime) / duration, 1);
    const currentLat = startLat + (endLat - startLat) * progress;
    const currentLng = startLng + (endLng - startLng) * progress;
    marker.setLatLng([currentLat, currentLng]);
    if (progress < 1) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

export { cubicBezierStep };
