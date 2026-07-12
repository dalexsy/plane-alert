import { Injectable } from '@angular/core';
import { HelicopterListService } from '../helicopter-list/helicopter-list.service';
import {
  isHelicopterByModel,
  isHelicopterByOperator,
} from './helicopter-identification-rules.util';

@Injectable({
  providedIn: 'root',
})
export class HelicopterIdentificationService {
  constructor(private helicopterListService: HelicopterListService) {}

  isHelicopter(icao: string, model?: string, operator?: string): boolean {
    try {
      if (this.helicopterListService.isHelicopter(icao)) return true;
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
    operator?: string
  ): {
    isHelicopter: boolean;
    identifiedByIcao: boolean;
    identifiedByOperator: boolean;
    identifiedByModel: boolean;
    model: string | undefined;
    operator: string | undefined;
    icao: string;
  } {
    const identifiedByIcao = this.helicopterListService.isHelicopter(icao);
    const identifiedByOperator = operator
      ? isHelicopterByOperator(operator)
      : false;
    const identifiedByModel = model ? isHelicopterByModel(model) : false;
    const isHelicopter =
      identifiedByIcao || identifiedByOperator || identifiedByModel;

    return {
      isHelicopter,
      identifiedByIcao,
      identifiedByOperator,
      identifiedByModel,
      model,
      operator,
      icao,
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
