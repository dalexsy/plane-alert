import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';
import { ScanService } from './scan.service';
import {
  LocationContextService,
  GeocodeResult,
} from './location-context.service';

@Injectable({
  providedIn: 'root',
})
export class AddressResolutionService {
  constructor(
    private settings: SettingsService,
    private scanService: ScanService,
    private locationContext: LocationContextService
  ) {}

  /**
   * Resolve address from input overlay and update location context accordingly
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
    const originalAddress = inputOverlayComponent.addressInputRef.getValue();

    // Make sure the input overlay processes any pending radius changes first
    inputOverlayComponent.processRadiusChange();

    // Use the stored radius (already in km) instead of reading input directly
    const mainRadius = this.settings.radius ?? 5;

    // Set the MAIN radius setting if valid
    if (!isNaN(mainRadius)) {
      this.settings.setRadius(mainRadius);
    }

    // Update the location context with the original address for geocoding
    const geocodeResult = await this.locationContext.updateFromAddress(
      originalAddress
    );

    // Format the address using geocoding context when available
    const formattedAddress = this.formatAddress(originalAddress, geocodeResult);

    // Save the formatted address as the current address in settings
    this.settings.setCurrentAddress(formattedAddress);

    // Update the input field with the formatted address
    inputOverlayComponent.currentAddress = formattedAddress;

    // Ensure subscribers receive the formatted address
    this.locationContext.setAddress(formattedAddress);

    // Force a scan at the end
    this.scanService.forceScan();
  }

  /**
   * Format an address string nicely without changing its meaning
   */
  private formatAddress(
    address: string,
    geocodeResult?: GeocodeResult
  ): string {
    const details = geocodeResult?.addressDetails;

    if (details) {
      const parts: string[] = [];
      const seen = new Set<string>();
      const addPart = (value?: string | null) => {
        if (!value) {
          return;
        }
        const trimmed = value.trim();
        if (!trimmed) {
          return;
        }
        const normalized = trimmed.toLowerCase();
        if (seen.has(normalized)) {
          return;
        }
        seen.add(normalized);
        parts.push(trimmed);
      };

      const roadLike =
        details.road ||
        details.pedestrian ||
        details.cycleway ||
        details.footway ||
        details.residential;
      const houseNumber = details.house_number;
      const streetLine = roadLike
        ? `${roadLike}${houseNumber ? ` ${houseNumber}` : ''}`
        : undefined;

      addPart(streetLine);
      addPart(details.neighbourhood);
      addPart(details.suburb);
      addPart(details.city_district);
      addPart(details.county);

      const locality =
        details.city ||
        details.town ||
        details.village ||
        details.municipality ||
        details.hamlet;
      const postcode = details.postcode?.trim();
      if (locality) {
        const cityLine = postcode ? `${postcode} ${locality}` : locality;
        addPart(cityLine);
      } else if (postcode) {
        addPart(postcode);
      }

      const state = details.state;
      if (state && state.toLowerCase() !== (locality || '').toLowerCase()) {
        addPart(state);
      }

      addPart(details.country);

      if (parts.length > 0) {
        return parts.join(', ');
      }
    }

    if (geocodeResult?.displayName) {
      return this.cleanDisplayName(geocodeResult.displayName);
    }

    return this.basicFormat(address);
  }

  private basicFormat(address: string): string {
    if (!address || address.trim() === '') {
      return address;
    }

    let formatted = address
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();

    let parts = formatted
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    parts = this.combineStreetAndNumber(parts);
    parts = this.dedupeParts(parts);

    formatted = parts.join(', ');

    formatted = formatted
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());

    return formatted;
  }

  private cleanDisplayName(displayName: string): string {
    let formatted = displayName
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();

    formatted = formatted.replace(/,\s*(\d+[A-Za-z]?)(?=,)/g, ' $1');

    let parts = formatted
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    parts = this.combineStreetAndNumber(parts);
    parts = this.dedupeParts(parts);

    return parts.join(', ');
  }

  private combineStreetAndNumber(parts: string[]): string[] {
    if (parts.length < 2) {
      return parts;
    }

    const [first, second, ...rest] = parts;
    const isFirstNumber = this.isHouseNumber(first);
    const isSecondNumber = this.isHouseNumber(second);

    if (
      isFirstNumber &&
      !isSecondNumber &&
      second &&
      /\p{L}/u.test(second) &&
      !/^\d/.test(second)
    ) {
      return [`${second} ${first}`, ...rest];
    }

    if (!isFirstNumber && isSecondNumber && second && /\p{L}/u.test(first)) {
      return [`${first} ${second}`, ...rest];
    }

    return parts;
  }

  private dedupeParts(parts: string[]): string[] {
    const seen = new Set<string>();
    return parts.filter((part) => {
      const normalized = part.toLowerCase();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
  }

  private isHouseNumber(value: string): boolean {
    const trimmed = value.trim();
    if (!/^\d+[A-Za-z]?([-/]\d+[A-Za-z]?)?$/.test(trimmed)) {
      return false;
    }

    const numericOnly = trimmed.replace(/[^\d]/g, '');
    if (!/[A-Za-z]/.test(trimmed) && numericOnly.length > 4) {
      return false;
    }

    return true;
  }
}
