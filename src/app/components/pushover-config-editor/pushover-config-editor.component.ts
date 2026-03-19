import {
  Component,
  Output,
  EventEmitter,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  COMMON_MILITARY_TYPES,
  BORING_AIRCRAFT_TYPES,
  type MilitaryAircraftType,
} from '@plane-alert/shared';
import { ButtonComponent } from '../ui/button.component';
import { IconComponent } from '../ui/icon.component';
import { InputComponent } from '../ui/input.component';
import {
  checkDeviceEndpoint,
  pushRegistrationEndpoint,
} from '../../config/firebase.config';
import { forwardGeocode, reverseGeocode } from '../../utils/geo-utils';

interface BackendDeviceConfig {
  radiusKm?: number;
  distanceUnit?: 'km' | 'miles';
  notifyProximity?: boolean;
  ignoredTypes?: string[];
  location?: {
    lat?: number;
    lon?: number;
    address?: string;
  };
  home?: {
    lat?: number;
    lon?: number;
    address?: string;
  };
  createdAt?: any;
  updatedAt?: any;
}

interface BackendDeviceEntry {
  deviceId: string;
  deviceName: string;
  platform?: string;
  config: BackendDeviceConfig;
  isRegisteredInPushover?: boolean;
}

interface DeviceListItem {
  name: string;
  docId: string | null;
  proximityEnabled: boolean;
  militaryEnabled: boolean;
  ignoredTypes: string[];
  location?: {
    lat: number;
    lon: number;
    address?: string;
  };
  isRegisteredInPushover: boolean;
}

@Component({
  selector: 'app-pushover-config-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    IconComponent,
    InputComponent,
  ],
  templateUrl: './pushover-config-editor.component.html',
  styleUrls: ['./pushover-config-editor.component.scss'],
})
export class PushoverConfigEditorComponent implements OnInit {
  @Output() closeEditor = new EventEmitter<void>();
  @Output() configSaved = new EventEmitter<{
    ignoredTypes: string[];
    radiusKm: number;
  }>();

  // Use shared military types from @plane-alert/shared
  commonMilitaryTypes: readonly MilitaryAircraftType[] = COMMON_MILITARY_TYPES;

  statusMessage = '';
  statusIcon = '';
  pushoverUserKey = '';

  keyValidated = false;
  isVerifyingKey = false;
  keyValidationError = '';

  devices: DeviceListItem[] = [];
  selectedDevice: DeviceListItem | null = null;
  isSaving = false;
  customIgnoreList = '';
  private savingDevices = new Set<string>(); // Track which devices are currently saving

  // Location editing
  locationSearchQuery = '';
  isEditingLocation = false;
  isGeocodingLocation = false;
  locationError = '';

  @ViewChild('locationInput') locationInputRef?: InputComponent;

  ngOnInit(): void {
    this.loadConfiguration();
    if (this.pushoverUserKey) {
      // Always fetch fresh data to ensure we have the latest from backend
      console.log(
        'Fetching device registration status for key:',
        this.pushoverUserKey,
      );
      void this.checkRegistrationStatus();
    }
  }

  async onPushoverKeyChange(value: string): Promise<void> {
    this.pushoverUserKey = value.trim();
    this.devices = [];
    this.selectedDevice = null;
    this.keyValidated = false;
    this.keyValidationError = '';
    if (this.pushoverUserKey.length >= 30) {
      await this.checkRegistrationStatus();
    }
  }

  selectDevice(device: DeviceListItem): void {
    this.selectedDevice = device;
    this.customIgnoreList = device.ignoredTypes
      .filter(
        (type) =>
          !this.commonMilitaryTypes.some(
            (mt) => mt.code === type.toUpperCase(),
          ),
      )
      .join('\n');
    this.isEditingLocation = false;
    this.locationSearchQuery = '';
    this.locationError = '';
  }

  getLocationDisplay(device: DeviceListItem): string {
    const location = device.location;

    if (!location?.lat || !location?.lon) {
      return 'Set location';
    }

    if (location.address) {
      const parts = location.address.split(',').map((p) => p.trim());
      if (parts.length >= 2) {
        return parts.slice(-3).join(', ');
      }
      return location.address;
    }

    // If no address, show coordinates with city hint
    const isBerlin =
      location.lat > 52 &&
      location.lat < 53 &&
      location.lon > 13 &&
      location.lon < 14;
    const isMunich =
      location.lat > 48 &&
      location.lat < 49 &&
      location.lon > 11 &&
      location.lon < 12;
    const cityHint = isBerlin
      ? ' (Berlin area)'
      : isMunich
        ? ' (Munich area)'
        : '';
    return `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}${cityHint}`;
  }

  startEditingLocation(device: DeviceListItem): void {
    this.selectedDevice = device;
    this.isEditingLocation = true;
    this.locationSearchQuery =
      this.getLocationDisplay(device) === 'Set location'
        ? ''
        : this.getLocationDisplay(device);
    this.locationError = '';

    setTimeout(() => {
      if (this.locationInputRef) {
        this.locationInputRef.focus();
        this.locationInputRef.select();
      }
    }, 50);
  }

  async saveLocationEdit(device: DeviceListItem): Promise<void> {
    if (!this.locationSearchQuery.trim()) {
      this.isEditingLocation = false;
      return;
    }

    this.isGeocodingLocation = true;
    this.locationError = '';

    try {
      const result = await forwardGeocode(this.locationSearchQuery.trim());

      if (result) {
        device.location = {
          lat: result.lat,
          lon: result.lon,
          address: result.displayName,
        };

        this.statusMessage = 'Saving location...';
        this.statusIcon = 'sync';

        await this.saveDevice(device, true);

        this.statusMessage = 'Location saved';
        this.statusIcon = 'check_circle';
        this.isEditingLocation = false;
        this.locationSearchQuery = '';

        setTimeout(() => {
          this.statusMessage = '';
          this.statusIcon = '';
        }, 2000);
      } else {
        this.locationError = 'Location not found. Try a different search.';
      }
    } catch (error) {
      console.error('Error geocoding location:', error);
      this.locationError = 'Failed to find location. Please try again.';
    } finally {
      this.isGeocodingLocation = false;
    }
  }

  isTypeIgnored(code: string): boolean {
    if (!this.selectedDevice) return false;
    return this.selectedDevice.ignoredTypes.includes(code.toUpperCase());
  }

  toggleType(code: string): void {
    if (!this.selectedDevice) return;
    const upperCode = code.toUpperCase();
    const index = this.selectedDevice.ignoredTypes.indexOf(upperCode);
    if (index >= 0) {
      this.selectedDevice.ignoredTypes.splice(index, 1);
    } else {
      this.selectedDevice.ignoredTypes.push(upperCode);
    }
  }

  onCustomFilterChange(): void {
    if (!this.selectedDevice) return;

    const customTypes = this.customIgnoreList
      .split('\n')
      .map((line) => line.trim().toUpperCase())
      .filter((line) => line.length > 0);

    const commonCodes = new Set(
      this.commonMilitaryTypes.map((mt) => mt.code.toUpperCase()),
    );

    // Keep only common types that are still checked
    this.selectedDevice.ignoredTypes = this.selectedDevice.ignoredTypes.filter(
      (type) => commonCodes.has(type),
    );

    // Add custom types
    customTypes.forEach((type) => {
      if (!this.selectedDevice!.ignoredTypes.includes(type)) {
        this.selectedDevice!.ignoredTypes.push(type);
      }
    });
  }

  async onCustomFilterBlur(): Promise<void> {
    if (!this.selectedDevice) return;

    // Update the ignored types
    this.onCustomFilterChange();

    // Show saving indicator
    this.statusMessage = 'Saving...';
    this.statusIcon = 'sync';

    // Save to backend
    await this.saveDevice(this.selectedDevice, true);

    // Show success
    this.statusMessage = 'Saved';
    this.statusIcon = 'check_circle';
    setTimeout(() => {
      this.statusMessage = '';
      this.statusIcon = '';
    }, 2000);
  }

  formatDeviceName(name: string): string {
    if (name === 'default') {
      return 'Default Device';
    }
    return name;
  }

  async onProximityChange(device: DeviceListItem): Promise<void> {
    // ngModel already updated the value, just save
    console.log(
      `Proximity changed for ${device.name}:`,
      device.proximityEnabled,
    );

    // Prevent concurrent saves for the same device
    if (this.savingDevices.has(device.name)) {
      console.log(`Skipping save for ${device.name} - already saving`);
      return;
    }

    await this.saveDevice(device, true);
  }

  async onMilitaryChange(device: DeviceListItem): Promise<void> {
    // ngModel already updated the value, handle logic and save
    console.log(`Military changed for ${device.name}:`, device.militaryEnabled);

    // If disabling, clear ignored types; if enabling, keep current filters
    if (!device.militaryEnabled) {
      device.ignoredTypes = ['*'];
    } else if (
      device.ignoredTypes.length === 1 &&
      device.ignoredTypes[0] === '*'
    ) {
      device.ignoredTypes = [];
    }

    // Prevent concurrent saves for the same device
    if (this.savingDevices.has(device.name)) {
      console.log(`Skipping save for ${device.name} - already saving`);
      return;
    }

    await this.saveDevice(device, true);
  }

  async removeDevice(device: DeviceListItem): Promise<void> {
    if (!device.docId) return;

    if (!confirm(`Remove ${this.formatDeviceName(device.name)}?`)) {
      return;
    }

    try {
      const response = await fetch(
        'https://us-central1-plane-alert-800ff.cloudfunctions.net/unsubscribeDevice',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: device.docId }),
        },
      );

      if (response.ok) {
        this.devices = this.devices.filter((d) => d.docId !== device.docId);
        this.statusMessage = 'Device removed';
        this.statusIcon = 'check_circle';
        setTimeout(() => {
          this.statusMessage = '';
          this.statusIcon = '';
        }, 3000);
      } else {
        this.statusMessage = 'Failed to remove device';
        this.statusIcon = 'error';
        setTimeout(() => {
          this.statusMessage = '';
          this.statusIcon = '';
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to remove device:', error);
      this.statusMessage = 'Failed to connect to server';
      this.statusIcon = 'error';
      setTimeout(() => {
        this.statusMessage = '';
        this.statusIcon = '';
      }, 3000);
    }
  }

  private loadConfiguration(): void {
    this.pushoverUserKey =
      localStorage.getItem('plane-alert-pushover-key') || '';
  }

  private async checkRegistrationStatus(): Promise<void> {
    if (!this.pushoverUserKey) {
      this.devices = [];
      return;
    }

    this.isVerifyingKey = true;
    this.keyValidationError = '';

    try {
      console.log(
        'Checking registration status for key:',
        this.pushoverUserKey.substring(0, 8) + '...',
      );

      const response = await fetch(checkDeviceEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pushoverUserKey: this.pushoverUserKey }),
      });

      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        this.keyValidated = false;
        this.keyValidationError =
          response.status >= 500
            ? 'Server error while verifying your key. Please try again.'
            : 'Unable to verify that key. Please check it and try again.';
        console.error(
          'Response not OK:',
          response.status,
          await response.text(),
        );
        return;
      }

      const data = await response.json();

      console.log('Backend response:', {
        keyValid: data.keyValid,
        devicesCount: data.devices?.length || 0,
        availableDevicesCount: data.availableDevices?.length || 0,
        devices: data.devices,
        availableDevices: data.availableDevices,
      });

      const backendDevices: BackendDeviceEntry[] = Array.isArray(data.devices)
        ? data.devices
        : [];

      const availableDevices = new Set<string>();
      if (Array.isArray(data.availableDevices)) {
        data.availableDevices
          .map((device: any) => String(device))
          .filter((name: string) => name.trim().length > 0)
          .forEach((name: string) => availableDevices.add(name.trim()));
      }

      // Build device list
      const deviceMap = new Map<string, DeviceListItem>();

      // Add registered devices from backend
      backendDevices.forEach((entry) => {
        const deviceName = entry.deviceName || 'default';
        const config = entry.config ?? {};
        const ignoredTypes = Array.isArray(config.ignoredTypes)
          ? config.ignoredTypes
          : [];
        // Military is disabled if ignoredTypes contains '*'
        const militaryDisabled =
          ignoredTypes.length === 1 && ignoredTypes[0] === '*';

        // Extract location from config (try both new 'location' and legacy 'home' fields)
        const deviceLocation = (config as any).location || config.home;

        console.log('Loading device from backend:', deviceName, {
          proximityEnabled: config.notifyProximity,
          militaryEnabled: !militaryDisabled,
          ignoredTypes,
          isRegisteredInPushover: entry.isRegisteredInPushover,
          location: deviceLocation,
        });
        deviceMap.set(deviceName, {
          name: deviceName,
          docId: entry.deviceId || null,
          proximityEnabled: config.notifyProximity === true,
          militaryEnabled: !militaryDisabled,
          ignoredTypes: [...ignoredTypes],
          location: deviceLocation,
          isRegisteredInPushover: entry.isRegisteredInPushover !== false,
        });
      });

      // Add available devices that aren't registered yet (these are from Pushover)
      availableDevices.forEach((name) => {
        if (!deviceMap.has(name)) {
          deviceMap.set(name, {
            name,
            docId: null,
            proximityEnabled: false,
            militaryEnabled: true,
            ignoredTypes: [...BORING_AIRCRAFT_TYPES], // Default: filter boring aircraft
            isRegisteredInPushover: true, // These come from Pushover API
          });
        }
      });

      // Only show devices that are registered in Pushover
      this.devices = Array.from(deviceMap.values())
        .filter((device) => device.isRegisteredInPushover)
        .sort((a, b) => a.name.localeCompare(b.name));

      console.log(
        'Final devices list after filtering:',
        this.devices.map((d) => ({
          name: d.name,
          proximityEnabled: d.proximityEnabled,
          militaryEnabled: d.militaryEnabled,
          docId: d.docId,
          isRegisteredInPushover: d.isRegisteredInPushover,
        })),
      );

      console.log(
        'All devices before filtering:',
        Array.from(deviceMap.values()).map((d) => ({
          name: d.name,
          isRegisteredInPushover: d.isRegisteredInPushover,
        })),
      );

      // If no devices after filtering but we have devices in the map, show all devices
      // This handles the case where the Pushover validation is failing but we have backend data
      if (this.devices.length === 0 && deviceMap.size > 0) {
        console.warn(
          'No devices passed Pushover filter, showing all backend devices',
        );
        this.devices = Array.from(deviceMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        );
      }

      // If still no devices, but we have availableDevices from Pushover, something is wrong
      if (this.devices.length === 0 && availableDevices.size > 0) {
        console.error(
          'Pushover reports',
          availableDevices.size,
          'available devices but none are showing. Available:',
          Array.from(availableDevices),
        );
      }

      this.keyValidated = data.keyValid === true;

      // Cache the device data
      const cachedDevicesKey = `pushover-devices-${this.pushoverUserKey}`;
      localStorage.setItem(
        cachedDevicesKey,
        JSON.stringify({
          devices: this.devices,
          keyValidated: this.keyValidated,
          timestamp: Date.now(),
        }),
      );

      // Auto-select first device if none selected
      if (this.devices.length > 0 && !this.selectedDevice) {
        this.selectDevice(this.devices[0]);
      }

      // Log coordinate details for debugging
      console.log('Device location summary:');
      this.devices.forEach((device) => {
        if (device.location?.lat && device.location?.lon) {
          const isBerlin =
            device.location.lat > 52 &&
            device.location.lat < 53 &&
            device.location.lon > 13 &&
            device.location.lon < 14;
          const isMunich =
            device.location.lat > 48 &&
            device.location.lat < 49 &&
            device.location.lon > 11 &&
            device.location.lon < 12;
          console.log(
            `  ${device.name}: ${device.location.lat.toFixed(4)}, ${device.location.lon.toFixed(4)} (${isBerlin ? 'BERLIN' : isMunich ? 'MUNICH' : 'OTHER'}) - ${device.location.address || 'NO ADDRESS'}`,
          );
        } else {
          console.log(`  ${device.name}: NO LOCATION SET`);
        }
      });
    } catch (error) {
      console.error('Failed to verify registration status:', error);
      this.keyValidated = false;
      this.keyValidationError =
        'Could not reach the verification service. Please check your connection and try again.';
    } finally {
      this.isVerifyingKey = false;
    }
  }

  private async saveDevice(
    device: DeviceListItem,
    silent: boolean = false,
  ): Promise<void> {
    if (this.isSaving && !silent) return; // Don't block silent saves

    // Mark this device as being saved
    this.savingDevices.add(device.name);

    // Prefer device-specific location over global home location
    let lat: number;
    let lon: number;
    let address: string | undefined;

    if (device.location?.lat && device.location?.lon) {
      // Use device-specific location if set
      lat = device.location.lat;
      lon = device.location.lon;
      address = device.location.address;
      console.log(
        `Saving device ${device.name} with device-specific location:`,
        { lat, lon, address },
      );
    } else {
      // Fall back to global home location
      const latitude = parseFloat(localStorage.getItem('user-latitude') || '0');
      const longitude = parseFloat(
        localStorage.getItem('user-longitude') || '0',
      );

      const savedHome = localStorage.getItem('plane-alert-home-location');
      const home = savedHome ? (JSON.parse(savedHome) as any) : null;

      lat = typeof home?.lat === 'number' ? home.lat : latitude;
      lon = typeof home?.lon === 'number' ? home.lon : longitude;
      address = home?.address;
      console.log(`Saving device ${device.name} with global home location:`, {
        lat,
        lon,
        address,
      });
    }

    if (!lat || !lon) {
      if (!silent) {
        this.statusMessage = 'Please set location for this device first';
        this.statusIcon = 'warning';
        setTimeout(() => {
          this.statusMessage = '';
          this.statusIcon = '';
        }, 4000);
      }
      return;
    }

    this.isSaving = true;

    const locationData: any = { lat, lon };
    if (address) {
      locationData.address = address;
    }

    const deviceData = {
      pushoverUserKey: this.pushoverUserKey.trim(),
      deviceName: device.name,
      platform: navigator?.userAgent || 'browser',
      distanceUnit: 'km' as const,
      radiusKm: 100,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      location: locationData,
      specialIcaos: [],
      notifyProximity: device.proximityEnabled,
      ignoredTypes: device.ignoredTypes,
    };

    // Validate coordinates match expected city
    if (address) {
      const isBerlinCoords = lat > 52 && lat < 53 && lon > 13 && lon < 14;
      const isMunichCoords = lat > 48 && lat < 49 && lon > 11 && lon < 12;
      const isBerlinAddress = address.toLowerCase().includes('berlin');
      const isMunichAddress =
        address.toLowerCase().includes('munich') ||
        address.toLowerCase().includes('münchen');

      if (
        (isBerlinAddress && !isBerlinCoords) ||
        (isMunichAddress && !isMunichCoords)
      ) {
        console.error(`⚠️ LOCATION MISMATCH for ${device.name}!`, {
          address,
          coordinates: { lat, lon },
          isBerlinCoords,
          isMunichCoords,
          isBerlinAddress,
          isMunichAddress,
        });
      }
    }

    console.log(
      '💾 Saving device payload:',
      device.name,
      JSON.stringify(deviceData, null, 2),
    );

    try {
      localStorage.setItem(
        'plane-alert-pushover-key',
        this.pushoverUserKey.trim(),
      );

      const response = await fetch(pushRegistrationEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deviceData),
      });

      if (!response.ok) {
        const error = await response.text();
        if (!silent) {
          this.statusMessage = error;
          this.statusIcon = 'error';
          setTimeout(() => {
            this.statusMessage = '';
            this.statusIcon = '';
          }, 4000);
        }
        return;
      }

      const payload = await response.json();
      console.log('Save response:', payload);

      if (payload?.deviceId && !device.docId) {
        device.docId = payload.deviceId;
      }

      // Update cache after successful save
      const cachedDevicesKey = `pushover-devices-${this.pushoverUserKey}`;
      localStorage.setItem(
        cachedDevicesKey,
        JSON.stringify({
          devices: this.devices,
          keyValidated: this.keyValidated,
          timestamp: Date.now(),
        }),
      );

      if (!silent) {
        this.statusMessage = 'Saved';
        this.statusIcon = 'check_circle';
        setTimeout(() => {
          this.statusMessage = '';
          this.statusIcon = '';
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to save device:', error);
      if (!silent) {
        this.statusMessage = 'Failed to connect';
        this.statusIcon = 'error';
        setTimeout(() => {
          this.statusMessage = '';
          this.statusIcon = '';
        }, 3000);
      }
    } finally {
      this.isSaving = false;
      // Remove device from saving set
      this.savingDevices.delete(device.name);
    }
  }

  async close(): Promise<void> {
    // Save any pending custom filter changes before closing
    if (this.selectedDevice && this.customIgnoreList.trim()) {
      this.onCustomFilterChange();
      await this.saveDevice(this.selectedDevice, true);
    }
    this.closeEditor.emit();
  }
}
