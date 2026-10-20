import { Component, Output, EventEmitter, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PushRegistrationService } from '../../services/push-registration/push-registration.service';
import { PwaPushService } from '../../services/pwa-push/pwa-push.service';
import { SettingsService } from '../../services/settings/settings.service';
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
    private pushRegistration: PushRegistrationService,
    private pwaPush: PwaPushService,
    private settings: SettingsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.state = loadPushoverConfig(
      COMMON_MILITARY_TYPES,
      this.pushRegistration.getStoredUserKey() || ''
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
    const wantsPwa = this.state.pwaAlertsEnabled;
    const wantsPushover =
      Boolean(this.state.pushoverUserKey?.trim()) && !wantsPwa;
    const wantsPushoverFallback =
      wantsPwa &&
      this.state.pushoverFallback &&
      Boolean(this.state.pushoverUserKey?.trim());

    if (!wantsPwa && !this.state.pushoverUserKey?.trim()) {
      this.setStatus('⚠ Enable PWA alerts or enter a Pushover user key', 4000);
      return;
    }

    syncCustomIgnoreList(this.state, COMMON_MILITARY_TYPES);
    const config = {
      ignoredTypes: Array.from(this.state.ignoredTypes),
      radiusKm: this.state.radiusKm,
      distanceUnit: this.state.distanceUnit,
    };
    localStorage.setItem('pushover-config', JSON.stringify(config));
    localStorage.setItem(
      'plane-alert-pushover-fallback',
      this.state.pushoverFallback ? '1' : '0',
    );

    const home = this.settings.getHomeLocation();
    if (!home?.lat || !home?.lon) {
      this.setStatus('⚠ Please set your location first (click the crosshair button)', 4000);
      return;
    }

    if (wantsPwa) {
      const pwaResult = await this.pwaPush.subscribePwaAlerts({
        prompt: true,
        pushoverFallback: wantsPushoverFallback,
        radiusKm: this.state.radiusKm,
        ignoredTypes: config.ignoredTypes,
      });
      if (pwaResult === 'denied') {
        this.setStatus('⚠ Notification permission denied in the browser', 4000);
        return;
      }
      if (pwaResult === 'unsupported') {
        this.setStatus('⚠ Web Push is not supported in this browser', 4000);
        return;
      }
      if (pwaResult !== 'subscribed') {
        this.setStatus('⚠ Could not register PWA alerts (check VAPID on server)', 5000);
        return;
      }
      if (this.state.confirmWebPushReceived) {
        const confirmed = await this.pwaPush.confirmWebPushAsPrimary();
        if (!confirmed) {
          this.setStatus('⚠ Could not save Web Push preference', 4000);
          return;
        }
      }
      if (this.state.preferPushoverChannel) {
        await this.pwaPush.preferPushoverChannel();
      }
    } else {
      await this.pwaPush.disablePwaAlerts();
    }

    if (wantsPushover) {
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
      const registered = await this.pushRegistration.registerDevice(
        this.state.pushoverUserKey.trim(),
        {
          radiusKm: this.state.radiusKm,
          distanceUnit: this.state.distanceUnit,
          ignoredTypes: config.ignoredTypes,
        }
      );
      if (!registered) {
        this.setStatus(
          '⚠ Could not match this browser to a Pushover device on your account.',
          4000
        );
        return;
      }
    }

    this.setStatus('✓ Notification settings saved', 3000);
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
