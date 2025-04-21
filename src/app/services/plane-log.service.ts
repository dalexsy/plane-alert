import { Injectable } from '@angular/core';
import { PlaneModel } from '../models/plane-model';
import { PlaneLogEntry } from '../components/results-overlay/results-overlay.component';

@Injectable({ providedIn: 'root' })
export class PlaneLogService {
  private planeLog = new Map<string, PlaneModel>();
  private planeHistoricalLog: PlaneModel[] = [];

  getLog(): Map<string, PlaneModel> {
    return this.planeLog;
  }

  getHistoricalLog(): PlaneModel[] {
    return this.planeHistoricalLog;
  }

  updateLog(updatedPlanes: PlaneModel[]): void {
    this.planeLog.clear();
    for (const plane of updatedPlanes) {
      this.planeLog.set(plane.icao, plane);
    }
  }

  updateHistoricalLog(planes: PlaneModel[]): void {
    this.planeHistoricalLog = planes;
  }

  clearHistoricalLog(): void {
    this.planeHistoricalLog = [];
  }
}
