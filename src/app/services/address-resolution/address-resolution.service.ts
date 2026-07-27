import { Injectable } from '@angular/core';
import { SettingsService } from '../settings/settings.service';
import { ScanService } from '../scan/scan.service';
import {
  LocationContextService,
  type GeocodeResult,
} from '../location-context/location-context.service';
import { formatResolvedAddress } from './address-format.util';

@Injectable({
  providedIn: 'root',
})
export class AddressResolutionService {
  constructor(
    private settings: SettingsService,
    private scanService: ScanService,
    private locationContext: LocationContextService
  ) {}

  formatAddress(input: string, result?: GeocodeResult): string {
    return formatResolvedAddress(input, result);
  }

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
    const originalAddress = inputOverlayComponent.addressInputRef?.getValue() ?? '';
    inputOverlayComponent.processRadiusChange();
    const mainRadius = this.settings.radius ?? 5;
    if (!isNaN(mainRadius)) {
      this.settings.setRadius(mainRadius);
    }

    const geocodeResult = await this.locationContext.updateFromAddress(
      originalAddress
    );
    const formattedAddress = this.formatAddress(originalAddress, geocodeResult);

    this.locationContext.setLocation(
      geocodeResult.lat,
      geocodeResult.lon,
      formattedAddress,
      'address'
    );
    this.settings.setLocationWithAddress(
      geocodeResult.lat,
      geocodeResult.lon,
      formattedAddress
    );
    this.scanService.forceScan();
  }
}
