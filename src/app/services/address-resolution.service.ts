import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';
import { ScanService } from './scan.service';

@Injectable({
  providedIn: 'root',
})
export class AddressResolutionService {
  constructor(
    private settings: SettingsService,
    private scanService: ScanService
  ) {}

  /**
   * Resolve address from input overlay and update map accordingly
   */
  async resolveAndUpdateFromAddress(
    inputOverlayComponent: any,
    updateMap: (
      lat: number,
      lon: number,
      radius?: number,
      zoomLevel?: number
    ) => Promise<void>,
    currentZoom?: number
  ): Promise<void> {
    const address = inputOverlayComponent.addressInputRef.getValue();

    // Make sure the input overlay processes any pending radius changes first
    // This ensures the stored radius is up-to-date with the current unit
    inputOverlayComponent.processRadiusChange();

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
    if (!atHome) {
      // Keep the cone visible when navigating to a searched address (if not at home)
      // The cone will now show full circular bands when away from home
      // No need to hide it or update the checkbox
    }

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
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          address
        )}`,
        {
          signal: controller.signal,
          headers: { 'User-Agent': 'PlaneAlert/1.0' },
        }
      );

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      if (data.length) {
        // Pass the mainRadius obtained from the input (or current setting if invalid)
        await updateMap(
          parseFloat(data[0].lat),
          parseFloat(data[0].lon),
          mainRadius, // Pass the potentially updated main radius
          currentZoom
        ); // Triggers airport search

        // Clear the address field after successful resolution
        inputOverlayComponent.clearAddressField();
      } else {
        console.warn('No results found for address:', address);
      }
    } catch (error) {
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
      } else if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Address search timed out:', address);
      } else {
        console.warn('Address search failed:', error);
      }
    }

    // Always force a scan at the end
    this.scanService.forceScan();
  }
}
