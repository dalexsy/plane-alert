import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';
import { PlaneModel } from '../models/plane-model';
import {
  getBaseMarkerIconData,
  isHelicopter, // Import from svg-icons
  svgPathToSvg, // Import from svg-icons
} from '../utils/svg-icons';
import { HelicopterListService } from './helicopter-list.service';

@Injectable({
  providedIn: 'root',
})
export class PlaneStyleService {
  constructor(
    private settingsService: SettingsService,
    private helicopterListService: HelicopterListService
  ) {}

  /**
   * Gets the appropriate SVG icon string for a plane based on its type and state.
   * @param plane The plane model object.
   * @returns The SVG string for the marker.
   */
  getPlaneIcon(plane: PlaneModel): string {
    // Use the imported isHelicopter function directly from svg-icons
    const isHeli = isHelicopter(
      plane.category,
      plane.model,
      this.helicopterListService.isHelicopter(plane.icao)
    );

    // Get the base icon data (path, size, etc.) using model type and category
    const iconData = getBaseMarkerIconData(plane.category, plane.model);

    // Generate the SVG string using the path and size from iconData
    // Fill color will be handled by CSS (currentColor)
    const svgString = svgPathToSvg(iconData.path, iconData.size); // Use imported function directly from svg-icons

    return svgString;
  }

  // Removed the checkIsHelicopter method as it's no longer needed

  getPlaneStyle(
    plane: PlaneModel,
    isSelected: boolean,
    isClosest: boolean,
    isFollowed: boolean
  ): string {
    let color = this.settingsService.planeColor;

    // ... rest of the getPlaneStyle method remains unchanged ...

    let altitude: number | 'ground' | null = null;
    if (plane.onGround) {
      altitude = 'ground';
    } else if (plane.positionHistory.length > 0) {
      const lastPos = plane.positionHistory[plane.positionHistory.length - 1];
      altitude = lastPos.altitude ?? null;
    }

    if (this.settingsService.altitudeColor) {
      if (altitude === 'ground') {
        color = this.settingsService.groundPlaneColor;
      } else if (typeof altitude === 'number') {
        if (altitude < 5000) color = '#ff0000';
        else if (altitude < 10000) color = '#ff7f00';
        else if (altitude < 20000) color = '#ffff00';
        else if (altitude < 30000) color = '#00ff00';
        else if (altitude < 40000) color = '#0000ff';
        else color = '#8a2be2';
      }
    }

    if (plane.isMilitary && this.settingsService.militaryColorOverride) {
      color = this.settingsService.militaryPlaneColor;
    } else if (plane.isSpecial && this.settingsService.specialColorOverride) {
      color = this.settingsService.specialPlaneColor;
    }

    if (isFollowed) {
      return `color: ${color}; border-color: #00ffff;`;
    } else if (isSelected) {
      return `color: ${color}; border-color: ${color}; filter: drop-shadow(0 0 5px ${color});`;
    } else if (isClosest) {
      return `color: ${color}; border-color: ${color}; filter: drop-shadow(0 0 3px ${color});`;
    }

    return `color: ${color}; border-color: ${color};`;
  }
}
