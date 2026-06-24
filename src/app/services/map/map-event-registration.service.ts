import { Injectable, ChangeDetectorRef, NgZone } from '@angular/core';
import { MapRuntimeService } from './map-runtime.service';
import { MapOverlayStateService } from './map-overlay-state.service';
import { MapPlaneOperationsService } from './map-plane-operations.service';
import { FollowCoordinatorService } from '../follow-coordinator.service';
import { SettingsService, ViewConeConfig } from '../settings.service';
import { BrightnessService } from '../brightness.service';
import { MapHostRefs } from './map-bootstrap.service';

@Injectable({ providedIn: 'root' })
export class MapEventRegistrationService {
  constructor(
    private ngZone: NgZone,
    private runtime: MapRuntimeService,
    private overlay: MapOverlayStateService,
    private followCoordinatorService: FollowCoordinatorService,
    private planeOps: MapPlaneOperationsService,
    private settings: SettingsService,
    private brightnessService: BrightnessService
  ) {}

  registerOnConstruct(refs: MapHostRefs): void {
    const { cdr } = refs;
    this.runtime.viewConesConfig = this.settings.viewConesConfig as ViewConeConfig[];

    const currentLocation = { lat: this.settings.lat, lon: this.settings.lon };
    if (currentLocation.lat !== null && currentLocation.lon !== null) {
      this.brightnessService.setLocation(currentLocation.lat, currentLocation.lon);
    }

    window.addEventListener('plane-tooltip-follow', (e: Event) => {
      const icao = (e as CustomEvent).detail?.icao;
      if (!icao) return;
      this.ngZone.run(() => {
        if (this.overlay.highlightedPlaneIcao === icao) {
          this.followCoordinatorService.clearAllModes();
        } else {
          const pm = this.runtime.planeLog.get(icao);
          if (pm) {
            this.followCoordinatorService.followPlaneManually(pm as never);
            if (pm.lat != null && pm.lon != null) {
              this.runtime.map?.panTo([pm.lat, pm.lon], {
                animate: true,
                duration: 1.0,
              });
              this.planeOps.reverseGeocode(pm.lat, pm.lon).then((address) => {
                this.overlay.locationDistrict = address;
                cdr.detectChanges();
              });
            }
          }
        }
      });
    });
  }
}
