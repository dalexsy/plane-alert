import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface BackendDeviceConfig {
  radiusKm?: number;
  distanceUnit?: 'km' | 'miles';
  notifyProximity?: boolean;
  ignoredTypes?: string[];
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
}

interface MilitaryAircraftType {
  code: string;
  name: string;
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
}

@Component({
  selector: 'app-pushover-config-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pushover-config-editor.component.html',
  styleUrls: ['./pushover-config-editor.component.scss'],
})
export class PushoverConfigEditorComponent implements OnInit {
  @Output() closeEditor = new EventEmitter<void>();
  @Output() configSaved = new EventEmitter<{
    ignoredTypes: string[];
    radiusKm: number;
  }>();

  commonMilitaryTypes: MilitaryAircraftType[] = [
    { code: 'C130', name: 'C-130 Hercules' },
    { code: 'C30J', name: 'C-130J Super Hercules' },
    { code: 'A400', name: 'A400M Atlas' },
    { code: 'C17', name: 'C-17 Globemaster' },
    { code: 'KC135', name: 'KC-135 Stratotanker' },
    { code: 'KC10', name: 'KC-10 Extender' },
    { code: 'KC46', name: 'KC-46 Pegasus' },
    { code: 'E3', name: 'E-3 Sentry (AWACS)' },
    { code: 'E2', name: 'E-2 Hawkeye' },
    { code: 'P8', name: 'P-8 Poseidon' },
    { code: 'F16', name: 'F-16 Fighting Falcon' },
    { code: 'F15', name: 'F-15 Eagle' },
    { code: 'F18', name: 'F-18 Hornet' },
    { code: 'F22', name: 'F-22 Raptor' },
    { code: 'F35', name: 'F-35 Lightning II' },
    { code: 'A10', name: 'A-10 Thunderbolt II' },
    { code: 'B52', name: 'B-52 Stratofortress' },
    { code: 'B1', name: 'B-1 Lancer' },
    { code: 'B2', name: 'B-2 Spirit' },
    { code: 'CH47', name: 'CH-47 Chinook' },
    { code: 'UH60', name: 'UH-60 Black Hawk' },
    { code: 'AH64', name: 'AH-64 Apache' },
  ];

  statusMessage = '';
  pushoverUserKey = '';

  keyValidated = false;
  isVerifyingKey = false;
  keyValidationError = '';

  devices: DeviceListItem[] = [];
  selectedDevice: DeviceListItem | null = null;
  isSaving = false;
  customIgnoreList = '';

  ngOnInit(): void {
    this.loadConfiguration();
    if (this.pushoverUserKey) {
      // Always fetch fresh data to ensure we have the latest from backend
      console.log(
        'Fetching device registration status for key:',
        this.pushoverUserKey
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
          !this.commonMilitaryTypes.some((mt) => mt.code === type.toUpperCase())
      )
      .join('\n');
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
      this.commonMilitaryTypes.map((mt) => mt.code.toUpperCase())
    );

    // Keep only common types that are still checked
    this.selectedDevice.ignoredTypes = this.selectedDevice.ignoredTypes.filter(
      (type) => commonCodes.has(type)
    );

    // Add custom types
    customTypes.forEach((type) => {
      if (!this.selectedDevice!.ignoredTypes.includes(type)) {
        this.selectedDevice!.ignoredTypes.push(type);
      }
    });
  }

  formatDeviceName(name: string): string {
    if (name === 'default') {
      return 'Default Device';
    }
    return name;
  }

  formatLocation(device: DeviceListItem): string {
    if (!device.location?.lat || !device.location?.lon) {
      return 'No location set';
    }
    
    // If there's an address, show that primarily with coords as backup
    if (device.location.address) {
      // Try to extract city/region from full address
      const parts = device.location.address.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        // Show last 2-3 parts (usually city, region, country)
        const shortAddress = parts.slice(-3).join(', ');
        return shortAddress;
      }
      return device.location.address;
    }
    
    // No address, show coordinates
    const lat = device.location.lat.toFixed(4);
    const lon = device.location.lon.toFixed(4);
    return `${lat}, ${lon}`;
  }

  async toggleProximity(device: DeviceListItem, event: Event): Promise<void> {
    event.stopPropagation();
    device.proximityEnabled = !device.proximityEnabled;
    await this.saveDevice(device, true);
  }

  async toggleMilitary(device: DeviceListItem, event: Event): Promise<void> {
    event.stopPropagation();
    device.militaryEnabled = !device.militaryEnabled;
    // If disabling, clear ignored types; if enabling, keep current filters
    if (!device.militaryEnabled) {
      device.ignoredTypes = ['*'];
    } else if (
      device.ignoredTypes.length === 1 &&
      device.ignoredTypes[0] === '*'
    ) {
      device.ignoredTypes = [];
    }
    await this.saveDevice(device, true);
  }

  async saveSelectedDevice(): Promise<void> {
    if (!this.selectedDevice) return;
    this.onCustomFilterChange();
    await this.saveDevice(this.selectedDevice, false);
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
        }
      );

      if (response.ok) {
        this.devices = this.devices.filter((d) => d.docId !== device.docId);
        this.statusMessage = '✓ Device removed';
        setTimeout(() => (this.statusMessage = ''), 3000);
      } else {
        this.statusMessage = '⚠ Failed to remove device';
        setTimeout(() => (this.statusMessage = ''), 3000);
      }
    } catch (error) {
      console.error('Failed to remove device:', error);
      this.statusMessage = '⚠ Failed to connect to server';
      setTimeout(() => (this.statusMessage = ''), 3000);
    }
  }

  private loadConfiguration(): void {
    this.pushoverUserKey = localStorage.getItem('pushover-user-key') || '';
  }

  private async checkRegistrationStatus(): Promise<void> {
    if (!this.pushoverUserKey) {
      this.devices = [];
      return;
    }

    this.isVerifyingKey = true;
    this.keyValidationError = '';

    try {
      const response = await fetch(
        'https://us-central1-plane-alert-800ff.cloudfunctions.net/checkDevice',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pushoverUserKey: this.pushoverUserKey }),
        }
      );

      if (!response.ok) {
        this.keyValidated = false;
        this.keyValidationError =
          response.status >= 500
            ? 'Server error while verifying your key. Please try again.'
            : 'Unable to verify that key. Please check it and try again.';
        return;
      }

      const data = await response.json();

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
        console.log('Loading device from backend:', deviceName, {
          proximityEnabled: config.notifyProximity,
          militaryEnabled: !militaryDisabled,
          ignoredTypes,
        });
        deviceMap.set(deviceName, {
          name: deviceName,
          docId: entry.deviceId || null,
          proximityEnabled: config.notifyProximity === true,
          militaryEnabled: !militaryDisabled,
          ignoredTypes: [...ignoredTypes],
          location: config.home || (config as any).location || undefined,
        });
      });

      // Add available devices that aren't registered yet
      availableDevices.forEach((name) => {
        if (!deviceMap.has(name)) {
          deviceMap.set(name, {
            name,
            docId: null,
            proximityEnabled: false,
            militaryEnabled: true,
            ignoredTypes: [],
          });
        }
      });

      this.devices = Array.from(deviceMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      console.log(
        'Final devices list:',
        this.devices.map((d) => ({
          name: d.name,
          proximityEnabled: d.proximityEnabled,
          militaryEnabled: d.militaryEnabled,
          docId: d.docId,
        }))
      );

      this.keyValidated = data.keyValid === true;

      // Cache the device data
      const cachedDevicesKey = `pushover-devices-${this.pushoverUserKey}`;
      localStorage.setItem(
        cachedDevicesKey,
        JSON.stringify({
          devices: this.devices,
          keyValidated: this.keyValidated,
          timestamp: Date.now(),
        })
      );

      // Auto-select first device if none selected
      if (this.devices.length > 0 && !this.selectedDevice) {
        this.selectDevice(this.devices[0]);
      }
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
    silent: boolean = false
  ): Promise<void> {
    if (this.isSaving) return;

    const latitude = parseFloat(localStorage.getItem('user-latitude') || '0');
    const longitude = parseFloat(localStorage.getItem('user-longitude') || '0');

    if (!latitude || !longitude) {
      if (!silent) {
        this.statusMessage = '⚠ Please set your location first';
        setTimeout(() => (this.statusMessage = ''), 4000);
      }
      return;
    }

    this.isSaving = true;

    const deviceData = {
      pushoverUserKey: this.pushoverUserKey.trim(),
      deviceName: device.name,
      platform: navigator?.userAgent || 'browser',
      distanceUnit: 'km' as const,
      radiusKm: 100,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      home: {
        lat: latitude,
        lon: longitude,
      },
      specialIcaos: [],
      notifyProximity: device.proximityEnabled,
      ignoredTypes: device.ignoredTypes,
    };

    console.log('Saving device:', device.name, deviceData);

    try {
      localStorage.setItem('pushover-user-key', this.pushoverUserKey.trim());

      const response = await fetch(
        'https://us-central1-plane-alert-800ff.cloudfunctions.net/registerDevice',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(deviceData),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        if (!silent) {
          this.statusMessage = `⚠ ${error}`;
          setTimeout(() => (this.statusMessage = ''), 4000);
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
        })
      );

      if (!silent) {
        this.statusMessage = '✓ Saved';
        setTimeout(() => (this.statusMessage = ''), 2000);
      }
    } catch (error) {
      console.error('Failed to save device:', error);
      if (!silent) {
        this.statusMessage = '⚠ Failed to connect';
        setTimeout(() => (this.statusMessage = ''), 3000);
      }
    } finally {
      this.isSaving = false;
    }
  }

  close(): void {
    this.closeEditor.emit();
  }
}
