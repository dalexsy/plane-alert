import { Injectable } from '@angular/core';
import { PlaneModel } from '../../models/plane-model';
import { haversineDistance } from '../../utils/geo-utils/geo-utils';
import { leafletPanShouldAnimate } from '../../utils/map-motion/map-motion.util';
import * as L from 'leaflet';

@Injectable({
  providedIn: 'root',
})
export class FollowService {
  constructor() {}

  /**
   * Update followed styles for all planes based on current follow state
   */
  updateFollowedStyles(
    planeLog: Map<string, PlaneModel>,
    highlightedPlaneIcao: string | null
  ): void {
    for (const plane of planeLog.values()) {
      const marker = plane.marker;
      if (marker) {
        const markerEl = marker.getElement();
        const tooltipEl = marker.getTooltip()?.getElement();
        // Always remove followed styles first
        markerEl?.classList.remove('highlighted-marker');
        if (tooltipEl) {
          tooltipEl.classList.remove('highlighted-tooltip');
          tooltipEl.classList.remove('followed-plane-tooltip');
        }
        marker.setZIndexOffset(0);
      }
    }
    // Now apply followed style to any currently highlighted plane (manual, shuffle, or nearest)
    if (highlightedPlaneIcao) {
      const followed = planeLog.get(highlightedPlaneIcao);
      if (followed && followed.marker) {
        const markerEl = followed.marker.getElement();
        const tooltipEl = followed.marker.getTooltip()?.getElement();
        followed.marker.setZIndexOffset(20000);
        markerEl?.classList.add('highlighted-marker');
        // Add followed-plane class for cyan border unless military or special
        if (
          markerEl &&
          !markerEl.classList.contains('military-plane') &&
          !markerEl.classList.contains('special-plane')
        ) {
          markerEl.classList.add('followed-plane');
        }
        if (tooltipEl) {
          tooltipEl.classList.add('highlighted-tooltip');
          tooltipEl.classList.add('followed-plane-tooltip');
        }
      }
    }
  }

  /**
   * Track and pan camera to followed plane's current position
   */
  trackFollowedPlane(
    planeLog: Map<string, PlaneModel>,
    highlightedPlaneIcao: string | null,
    map: L.Map
  ): void {
    // Only track if we have a followed plane and following is active
    if (!highlightedPlaneIcao || !map) {
      return;
    }

    const followedPlane = planeLog.get(highlightedPlaneIcao);
    if (
      !followedPlane ||
      followedPlane.lat == null ||
      followedPlane.lon == null
    ) {
      return;
    }

    // Get current map center
    const currentCenter = map.getCenter();
    const followedPosition = [followedPlane.lat, followedPlane.lon] as [
      number,
      number
    ];

    // Calculate distance between current center and followed plane
    const distance = haversineDistance(
      currentCenter.lat,
      currentCenter.lng,
      followedPosition[0],
      followedPosition[1]
    );

    // Only pan if the plane has moved a significant distance (>50m) from map center
    // This prevents constant micro-adjustments and unnecessary camera movement
    const panThresholdKm = 0.05; // 50 meters
    if (distance > panThresholdKm) {
      // Pan map to followed plane with smooth animation
      map.panTo(followedPosition, {
        animate: leafletPanShouldAnimate(),
        duration: 1.5, // Slightly longer duration for smoother tracking
        easeLinearity: 0.1, // Smooth easing
      });
    }
  }
}
