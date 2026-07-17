import { Injectable } from '@angular/core';
import { HelicopterListService } from '../helicopter-list/helicopter-list.service';
import {
  isHelicopterByCallsign,
  isHelicopterByModel,
  isHelicopterByOperator,
  isHelicopterByTypeDesignator,
} from './helicopter-identification-rules.util';

@Injectable({
  providedIn: 'root',
})
export class HelicopterIdentificationService {
  constructor(private helicopterListService: HelicopterListService) {}

  isHelicopter(
    icao: string,
    model?: string,
    operator?: string,
    callsign?: string,
    icaoType?: string
  ): boolean {
    try {
      if (this.helicopterListService.isHelicopter(icao)) return true;
      if (callsign && isHelicopterByCallsign(callsign)) return true;
      if (icaoType && isHelicopterByTypeDesignator(icaoType)) return true;
      if (operator && isHelicopterByOperator(operator)) return true;
      if (!model || typeof model !== 'string') return false;
      return isHelicopterByModel(model);
    } catch {
      return false;
    }
  }

  getHelicopterIdentificationDetails(
    icao: string,
    model?: string,
    operator?: string,
    callsign?: string,
    icaoType?: string
  ): {
    isHelicopter: boolean;
    identifiedByIcao: boolean;
    identifiedByCallsign: boolean;
    identifiedByTypeDesignator: boolean;
    identifiedByOperator: boolean;
    identifiedByModel: boolean;
    model: string | undefined;
    operator: string | undefined;
    icao: string;
    callsign?: string;
    icaoType?: string;
  } {
    const identifiedByIcao = this.helicopterListService.isHelicopter(icao);
    const identifiedByCallsign = callsign ? isHelicopterByCallsign(callsign) : false;
    const identifiedByTypeDesignator = icaoType
      ? isHelicopterByTypeDesignator(icaoType)
      : false;
    const identifiedByOperator = operator ? isHelicopterByOperator(operator) : false;
    const identifiedByModel = model ? isHelicopterByModel(model) : false;
    const isHelicopter =
      identifiedByIcao ||
      identifiedByCallsign ||
      identifiedByTypeDesignator ||
      identifiedByOperator ||
      identifiedByModel;

    return {
      isHelicopter,
      identifiedByIcao,
      identifiedByCallsign,
      identifiedByTypeDesignator,
      identifiedByOperator,
      identifiedByModel,
      model,
      operator,
      icao,
      callsign,
      icaoType,
    };
  }

  async refreshHelicopterList(force: boolean = false): Promise<boolean> {
    try {
      return await this.helicopterListService.refreshHelicopterList(force);
    } catch {
      return false;
    }
  }

  get helicopterListUpdated$() {
    return this.helicopterListService.helicopterListUpdated$;
  }
}
