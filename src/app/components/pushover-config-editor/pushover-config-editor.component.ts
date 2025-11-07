import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface MilitaryAircraftType {
  code: string;
  name: string;
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

  ignoredTypes: Set<string> = new Set();
  customIgnoreList = '';
  radiusKm = 100;
  distanceUnit: 'km' | 'miles' = 'km';
  statusMessage = '';
  pushoverUserKey = '';

  ngOnInit(): void {
    this.loadConfiguration();
  }

  private loadConfiguration(): void {
    // Load Pushover user key
    this.pushoverUserKey = localStorage.getItem('pushover-user-key') || '';

    // Load from localStorage
    const saved = localStorage.getItem('pushover-config');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        this.ignoredTypes = new Set(config.ignoredTypes || []);
        this.radiusKm = config.radiusKm || 100;
        this.distanceUnit = config.distanceUnit || 'km';
        
        // Populate custom ignore list (types not in common list)
        const customTypes = Array.from(this.ignoredTypes).filter(
          (type) =>
            !this.commonMilitaryTypes.some((mt) => mt.code === type.toUpperCase())
        );
        this.customIgnoreList = customTypes.join('\n');
      } catch (e) {
        console.error('Failed to load pushover config:', e);
      }
    }

    // Try to get distance unit from existing device registration
    const pushoverKey = localStorage.getItem('pushover-user-key');
    if (pushoverKey) {
      const deviceConfig = localStorage.getItem('pushover-device-config');
      if (deviceConfig) {
        try {
          const config = JSON.parse(deviceConfig);
          this.distanceUnit = config.distanceUnit || 'km';
          this.radiusKm = config.radiusKm || 100;
        } catch (e) {
          // Ignore
        }
      }
    }
  }

  isTypeIgnored(code: string): boolean {
    return this.ignoredTypes.has(code.toUpperCase());
  }

  toggleType(code: string): void {
    const upperCode = code.toUpperCase();
    if (this.ignoredTypes.has(upperCode)) {
      this.ignoredTypes.delete(upperCode);
    } else {
      this.ignoredTypes.add(upperCode);
    }
  }

  onCustomFilterChange(): void {
    // Parse custom ignore list and add to ignoredTypes
    const customTypes = this.customIgnoreList
      .split('\n')
      .map((line) => line.trim().toUpperCase())
      .filter((line) => line.length > 0);

    // Remove old custom types
    const commonCodes = new Set(
      this.commonMilitaryTypes.map((mt) => mt.code.toUpperCase())
    );
    Array.from(this.ignoredTypes).forEach((type) => {
      if (!commonCodes.has(type)) {
        this.ignoredTypes.delete(type);
      }
    });

    // Add new custom types
    customTypes.forEach((type) => this.ignoredTypes.add(type));
  }

  onRadiusChange(value: number): void {
    this.radiusKm = value;
  }

  async save(): Promise<void> {
    // Validate Pushover key
    if (!this.pushoverUserKey || this.pushoverUserKey.trim().length === 0) {
      this.statusMessage = '⚠ Please enter your Pushover user key';
      setTimeout(() => (this.statusMessage = ''), 3000);
      return;
    }

    // Save Pushover key
    localStorage.setItem('pushover-user-key', this.pushoverUserKey.trim());

    // Merge custom types from textarea
    this.onCustomFilterChange();

    const config = {
      ignoredTypes: Array.from(this.ignoredTypes),
      radiusKm: this.radiusKm,
      distanceUnit: this.distanceUnit,
    };

    // Save to localStorage
    localStorage.setItem('pushover-config', JSON.stringify(config));

    // Register/update device on Firebase
    try {
      const latitude = parseFloat(localStorage.getItem('user-latitude') || '0');
      const longitude = parseFloat(
        localStorage.getItem('user-longitude') || '0'
      );

      if (!latitude || !longitude) {
        this.statusMessage =
          '⚠ Please set your location first (click the crosshair button)';
        setTimeout(() => (this.statusMessage = ''), 4000);
        return;
      }

      const deviceData = {
        userKey: this.pushoverUserKey.trim(),
        latitude,
        longitude,
        radiusKm: this.radiusKm,
        distanceUnit: this.distanceUnit,
        ignoredTypes: config.ignoredTypes,
      };

      // Save device config for future updates
      localStorage.setItem('pushover-device-config', JSON.stringify(deviceData));

      const response = await fetch(
        'https://us-central1-plane-alert-800ff.cloudfunctions.net/registerDevice',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(deviceData),
        }
      );

      if (response.ok) {
        this.statusMessage = '✓ Push notifications configured successfully!';
        setTimeout(() => (this.statusMessage = ''), 3000);
      } else {
        const error = await response.text();
        this.statusMessage = `⚠ Server error: ${error}`;
        setTimeout(() => (this.statusMessage = ''), 4000);
      }
    } catch (error) {
      console.error('Failed to register device:', error);
      this.statusMessage = '⚠ Failed to connect to server';
      setTimeout(() => (this.statusMessage = ''), 3000);
    }

    this.configSaved.emit(config);
  }

  close(): void {
    this.closeEditor.emit();
  }
}
