import { Injectable } from '@angular/core';
import { PlaneDataOrchestratorService } from './plane-data-orchestrator.service';
import { PlaneFollowService } from './plane-follow.service';

/**
 * Service to handle URL parameter processing
 * Keeps URL-related logic separate from component monoliths
 */
@Injectable({
  providedIn: 'root',
})
export class UrlParameterService {
  constructor(
    private planeDataOrchestrator: PlaneDataOrchestratorService,
    private planeFollowService: PlaneFollowService
  ) {}

  /**
   * Check URL for parameters and handle them appropriately
   */
  checkUrlParameters(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const icao = urlParams.get('icao');
    const follow = urlParams.get('follow');
    const setupPushover = urlParams.get('setup');

    if (setupPushover === 'pushover') {
      // Show Pushover setup prompt
      setTimeout(() => {
        this.showPushoverSetup();
      }, 1000);
    }

    if (icao) {
      // Check if we should follow the plane (from push notification)
      const shouldFollow = follow === '1' || follow === 'true';

      // Wait for map to initialize and planes to load
      setTimeout(() => {
        this.followPlaneByIcao(icao, shouldFollow);
      }, 2000);
    }
  }

  /**
   * Follow a plane by ICAO code
   */
  private followPlaneByIcao(
    icao: string,
    shouldFollow: boolean = false,
    retryCount: number = 0
  ): void {
    const plane = this.planeDataOrchestrator.getPlane(icao);
    if (plane) {
      console.log(`Following plane ${icao} from URL parameter`);

      // Create a minimal plane object compatible with PlaneFollowService
      const followPlane = {
        icao: plane.icao,
        callsign: plane.callsign || icao,
        lat: plane.lat,
        lon: plane.lon,
        altitude: plane.altitude,
        bearing: plane.bearing,
        velocity: plane.velocity,
      } as any;

      // Always follow the plane (whether from notification or direct link)
      this.planeFollowService.followPlane(
        followPlane,
        false,
        false,
        false,
        true // fromManual = true
      );
    } else {
      // Retry up to 20 times (60 seconds total) to wait for plane data to load
      if (retryCount < 20) {
        console.log(
          `Plane ${icao} not found, retry ${retryCount + 1}/20 in 3 seconds...`
        );
        setTimeout(() => {
          this.followPlaneByIcao(icao, shouldFollow, retryCount + 1);
        }, 3000);
      } else {
        console.warn(
          `Plane ${icao} not found after 20 retries (60 seconds). It may be out of range or landed.`
        );
        // Show user-friendly message
        alert(
          `Aircraft ${icao.toUpperCase()} not found.\n\n` +
            `This can happen if:\n` +
            `• The aircraft is out of range (check your radius setting)\n` +
            `• The aircraft has landed\n` +
            `• Your location is not set correctly\n\n` +
            `Try increasing your search radius or checking your home location.`
        );
      }
    }
  }

  /**
   * Show Pushover setup instructions
   */
  private showPushoverSetup(): void {
    const userKey = prompt(
      'Enter your Pushover User Key to receive plane alerts on this device.\n\n' +
        'To get your User Key:\n' +
        '1. Sign up at https://pushover.net (free)\n' +
        '2. Find your User Key on your dashboard\n' +
        '3. Paste it here\n\n' +
        'Your User Key:'
    );

    if (userKey && userKey.trim().length > 0) {
      alert(
        'User Key saved!\n\n' +
          'Next steps:\n' +
          '1. Go to your location settings (top-left controls)\n' +
          '2. Set your home location\n' +
          '3. Aircraft alerts will be sent to your device\n\n' +
          'User Key: ' +
          userKey.trim()
      );

      // Store the user key in localStorage for future use
      localStorage.setItem('pushoverUserKey', userKey.trim());
    }
  }

  /**
   * Trigger Pushover setup manually (for UI button)
   */
  public triggerPushoverSetup(): void {
    this.showPushoverSetup();
  }
}
