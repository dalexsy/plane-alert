import { Injectable } from '@angular/core';
import { SettingsService } from '../settings/settings.service';

@Injectable({
  providedIn: 'root',
})
export class AddressService {
  constructor(private settings: SettingsService) {}

  /**
   * Resolve and update map from address input
   */
  async resolveAndUpdateFromAddress(
    address: string,
    inputOverlayComponent: any,
    updateMapCallback: (
      lat: number,
      lon: number,
      radius: number,
      zoom?: number
    ) => void,
    forceScanCallback: () => void
  ): Promise<void> {
    // Make sure the input overlay processes any pending radius changes first
    if (inputOverlayComponent?.processRadiusChange) {
      inputOverlayComponent.processRadiusChange();
    }

    // Use the stored radius (already in km) instead of reading input directly
    const mainRadius = this.settings.radius ?? 5;

    // Check if we're at home location before clearing cones
    const homeLocation = this.settings.getHomeLocation();
    const lat = this.settings.lat ?? 52.3667;
    const lon = this.settings.lon ?? 13.5033;

    // Only clear cones if we're not at home
    const atHome =
      homeLocation &&
      Math.abs(lat - homeLocation.lat) < 0.0001 &&
      Math.abs(lon - homeLocation.lon) < 0.0001;

    // Set the MAIN radius setting if valid
    if (!isNaN(mainRadius)) {
      this.settings.setRadius(mainRadius);
    } else {
      // Use the current setting if input is invalid
      // mainRadius = this.settings.radius ?? 5; // No need, updateMap handles undefined radiusKm
    }

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const response = await fetch(
        `/nominatim/search?format=json&q=${encodeURIComponent(address)}`,
        {
          signal: controller.signal,
          headers: { 'User-Agent': 'PlaneAlert/1.0' },
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.length) {
        const currentZoom = undefined; // Preserve current zoom level
        // Pass the mainRadius obtained from the input (or current setting if invalid)
        updateMapCallback(
          parseFloat(data[0].lat),
          parseFloat(data[0].lon),
          mainRadius, // Pass the potentially updated main radius
          currentZoom
        );

        // Clear the address field after successful resolution
        if (inputOverlayComponent?.clearAddressField) {
          inputOverlayComponent.clearAddressField();
        }
      } else {
        console.warn('No results found for address:', address);
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      // Specific handling for CORS/network errors
      if (
        error instanceof TypeError &&
        error.message.includes('Failed to fetch')
      ) {
        console.warn(
          'Address search blocked by CORS policy or network error:',
          address
        );
      } else if (error.name === 'AbortError') {
        console.warn('Address search timed out:', address);
      } else {
        console.warn('Address search failed:', error);
      }
    }

    // Always force a scan at the end
    forceScanCallback();
  }
}
