import type { PlaneLogEntry } from '../../types/plane-log-entry';
import { formatModelList, numberToWord } from '../announcement/announcement-speech.util';

export function buildOperatorAnnouncementText(operator: string, aircraft: PlaneLogEntry[]): string {
  if (aircraft.length === 1) {
    const model = aircraft[0].model?.trim();
    return model ? `${operator} ${model}` : operator;
  }
  const models = aircraft
    .map((plane) => plane.model?.trim())
    .filter((model): model is string => model !== undefined && model.length > 0);
  const uniqueModels = [...new Set(models)];
  if (uniqueModels.length === 0) {
    return aircraft.length === 2 ? `${operator}, two aircraft` : `${operator}, ${aircraft.length} aircraft`;
  }
  if (uniqueModels.length === 1) {
    if (models.length === aircraft.length && aircraft.length === 2) {
      return `${operator}, two ${uniqueModels[0]}s`;
    }
    if (models.length === aircraft.length) {
      return `${operator}, ${numberToWord(aircraft.length)} ${uniqueModels[0]}s`;
    }
    return `${operator} ${uniqueModels[0]}`;
  }
  return `${operator} ${formatModelList(uniqueModels)}`;
}

export function buildCountryAnnouncementText(countryKey: string, aircraft: PlaneLogEntry[]): string {
  if (aircraft.length === 0) return `${countryKey} military`;
  const operatorGroups = new Map<string, PlaneLogEntry[]>();
  const noOperator: PlaneLogEntry[] = [];
  aircraft.forEach((plane) => {
    const operator = plane.operator?.trim();
    if (operator) {
      if (!operatorGroups.has(operator)) operatorGroups.set(operator, []);
      operatorGroups.get(operator)!.push(plane);
    } else {
      noOperator.push(plane);
    }
  });
  if (operatorGroups.size === 1 && noOperator.length === 0) {
    const [operator, planes] = Array.from(operatorGroups.entries())[0];
    return buildOperatorAnnouncementText(operator, planes);
  }
  if (operatorGroups.size > 0) {
    const largestGroup = Array.from(operatorGroups.entries()).sort(([, a], [, b]) => b.length - a.length)[0];
    if (largestGroup[1].length >= aircraft.length * 0.7) {
      return buildOperatorAnnouncementText(largestGroup[0], largestGroup[1]);
    }
  }
  return aircraft.length === 1 ? `${countryKey} military` : `${countryKey} military, ${aircraft.length} aircraft`;
}

export function buildOperatorGroupAnnouncement(
  operator: string,
  planes: PlaneLogEntry[]
): string {
  if (planes.length === 1) {
    const model = planes[0].model?.trim();
    return model ? `${operator} ${model}` : operator;
  }
  const models = planes
    .map((plane) => plane.model?.trim())
    .filter((model): model is string => model !== undefined && model.length > 0);
  const uniqueModels = [...new Set(models)];
  if (uniqueModels.length === 0) return `${operator}, ${planes.length} aircraft`;
  if (uniqueModels.length === 1) {
    const modelCount = models.filter((m) => m === uniqueModels[0]).length;
    if (modelCount === planes.length && planes.length === 2) return `${operator}, two ${uniqueModels[0]}s`;
    if (modelCount === planes.length && planes.length > 2) {
      return `${operator}, ${numberToWord(planes.length)} ${uniqueModels[0]}s`;
    }
    if (modelCount < planes.length) {
      const unknownCount = planes.length - modelCount;
      return unknownCount === 1
        ? `${operator}, ${uniqueModels[0]} and one other`
        : `${operator}, ${uniqueModels[0]} and ${unknownCount} others`;
    }
    return `${operator}, ${uniqueModels[0]}`;
  }
  return `${operator}, ${formatModelList(uniqueModels)}`;
}
