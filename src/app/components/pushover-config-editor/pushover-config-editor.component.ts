import { Component, Output, EventEmitter, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseMessagingService } from '../../services/firebase-messaging.service';
import { SettingsService } from '../../services/settings.service';
import {
  PushoverConfigState,
  loadPushoverConfig,
  syncCustomIgnoreList,
  COMMON_MILITARY_TYPES,
} from '../../services/pushover/pushover-config.util';
import { PushoverTypeGridComponent } from './pushover-type-grid/pushover-type-grid.component';
import { PushoverFormSectionsComponent } from './pushover-form-sections/pushover-form-sections.component';

@Component({
  selector: 'app-pushover-config-editor',
  standalone: true,
  imports: [CommonModule, PushoverTypeGridComponent, PushoverFormSectionsComponent],
  templateUrl: './pushover-config-editor.component.html',
  styleUrl: './pushover-config-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PushoverConfigEditorComponent implements OnInit {
  @Output() closeEditor = new EventEmitter<void>();
  @Output() configSaved = new EventEmitter<{ ignoredTypes: string[]; radiusKm: number }>();

  state!: PushoverConfigState;
  statusMessage = '';

  constructor(
    private firebaseMessaging: FirebaseMessagingService,
    private settings: SettingsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.state = loadPushoverConfig(
      COMMON_MILITARY_TYPES,
      this.firebaseMessaging.getStoredUserKey() || ''
    );
  }

  onCustomFilterChange(): void {
    syncCustomIgnoreList(this.state, COMMON_MILITARY_TYPES);
    this.cdr.markForCheck();
  }

  onStateChange(): void {
    this.cdr.markForCheck();
  }

  async save(): Promise<void> {
    if (!this.state.pushoverUserKey?.trim()) {
      this.setStatus('⚠ Please enter your Pushover user key', 3000);
      return;
    }
    syncCustomIgnoreList(this.state, COMMON_MILITARY_TYPES);
    const config = {
      ignoredTypes: Array.from(this.state.ignoredTypes),
      radiusKm: this.state.radiusKm,
      distanceUnit: this.state.distanceUnit,
    };
    localStorage.setItem('pushover-config', JSON.stringify(config));
    const home = this.settings.getHomeLocation();
    if (!home?.lat || !home?.lon) {
      this.setStatus('⚠ Please set your location first (click the crosshair button)', 4000);
      return;
    }
    localStorage.setItem(
      'pushover-device-config',
      JSON.stringify({
        userKey: this.state.pushoverUserKey.trim(),
        latitude: home.lat,
        longitude: home.lon,
        radiusKm: this.state.radiusKm,
        distanceUnit: this.state.distanceUnit,
        ignoredTypes: config.ignoredTypes,
      })
    );
    const registered = await this.firebaseMessaging.registerDevice(
      this.state.pushoverUserKey.trim(),
      {
        radiusKm: this.state.radiusKm,
        distanceUnit: this.state.distanceUnit,
        ignoredTypes: config.ignoredTypes,
      }
    );
    this.setStatus(
      registered
        ? '✓ Push notifications configured successfully!'
        : '⚠ Could not match this browser to a Pushover device on your account.',
      registered ? 3000 : 4000
    );
    this.configSaved.emit(config);
  }

  close(): void {
    this.closeEditor.emit();
  }

  private setStatus(message: string, ms: number): void {
    this.statusMessage = message;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.statusMessage = '';
      this.cdr.markForCheck();
    }, ms);
  }
}
