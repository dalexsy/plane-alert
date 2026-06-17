import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseMessagingService } from '../../services/firebase-messaging.service';
import { SettingsService } from '../../services/settings.service';

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

  constructor(
    private firebaseMessaging: FirebaseMessagingService,
    private settings: SettingsService
  ) {}

  ngOnInit(): void {
    this.loadConfiguration();
  }

  private loadConfiguration(): void {
    this.pushoverUserKey = this.firebaseMessaging.getStoredUserKey() || '';

    const saved = localStorage.getItem('pushover-config');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        this.ignoredTypes = new Set(config.ignoredTypes || []);
        this.radiusKm = config.radiusKm || 100;
        this.distanceUnit = config.distanceUnit || 'km';

        const customTypes = Array.from(this.ignoredTypes).filter(
          (type) =>
            !this.commonMilitaryTypes.some(
              (mt) => mt.code === type.toUpperCase()
            )
        );
        this.customIgnoreList = customTypes.join('\n');
      } catch (e) {
        console.error('Failed to load pushover config:', e);
      }
    }

    if (this.pushoverUserKey) {
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
    const customTypes = this.customIgnoreList
      .split('\n')
      .map((line) => line.trim().toUpperCase())
      .filter((line) => line.length > 0);

    const commonCodes = new Set(
      this.commonMilitaryTypes.map((mt) => mt.code.toUpperCase())
    );
    Array.from(this.ignoredTypes).forEach((type) => {
      if (!commonCodes.has(type)) {
        this.ignoredTypes.delete(type);
      }
    });

    customTypes.forEach((type) => this.ignoredTypes.add(type));
  }

  onRadiusChange(value: number): void {
    this.radiusKm = value;
  }

  async save(): Promise<void> {
    if (!this.pushoverUserKey || this.pushoverUserKey.trim().length === 0) {
      this.statusMessage = '⚠ Please enter your Pushover user key';
      setTimeout(() => (this.statusMessage = ''), 3000);
      return;
    }

    this.onCustomFilterChange();

    const config = {
      ignoredTypes: Array.from(this.ignoredTypes),
      radiusKm: this.radiusKm,
      distanceUnit: this.distanceUnit,
    };

    localStorage.setItem('pushover-config', JSON.stringify(config));

    const home = this.settings.getHomeLocation();
    if (!home?.lat || !home?.lon) {
      this.statusMessage =
        '⚠ Please set your location first (click the crosshair button)';
      setTimeout(() => (this.statusMessage = ''), 4000);
      return;
    }

    localStorage.setItem(
      'pushover-device-config',
      JSON.stringify({
        userKey: this.pushoverUserKey.trim(),
        latitude: home.lat,
        longitude: home.lon,
        radiusKm: this.radiusKm,
        distanceUnit: this.distanceUnit,
        ignoredTypes: config.ignoredTypes,
      })
    );

    const registered = await this.firebaseMessaging.registerDevice(
      this.pushoverUserKey.trim(),
      {
        radiusKm: this.radiusKm,
        distanceUnit: this.distanceUnit,
        ignoredTypes: config.ignoredTypes,
      }
    );

    if (registered) {
      this.statusMessage = '✓ Push notifications configured successfully!';
      setTimeout(() => (this.statusMessage = ''), 3000);
    } else {
      this.statusMessage =
        '⚠ Could not match this browser to a Pushover device on your account.';
      setTimeout(() => (this.statusMessage = ''), 4000);
    }

    this.configSaved.emit(config);
  }

  close(): void {
    this.closeEditor.emit();
  }
}
