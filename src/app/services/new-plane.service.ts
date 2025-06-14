import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NewPlaneService {
  private previousScanPlanes = new Set<string>();

  isNew(icao: string): boolean {
    const result = !this.previousScanPlanes.has(icao);
    return result;
  }

  updatePlanes(newSet: Set<string>): void {
    this.previousScanPlanes = new Set(newSet);
  }

  getPreviousScanPlanes(): Set<string> {
    return this.previousScanPlanes;
  }
}
