import { buildPlaneTooltipHtml } from './plane-tooltip-html.util';

export function planeTooltip(
  id: string,
  callsign: string,
  origin: string,
  model: string,
  operator: string,
  speedText: string,
  altText: string,
  getFlagHTML: (origin: string) => string,
  isNew: boolean,
  isGrounded: boolean,
  isMilitary: boolean,
  isSpecial: boolean,
  verticalRate: number | null,
  altitude?: number | null,
  getAltitudeColor?: (alt: number) => string,
  getOperatorLogo?: (plane: {
    operator: string;
    country: string;
    isMilitary: boolean;
  }) => string,
  distanceText?: string,
): string {
  return buildPlaneTooltipHtml({
    id,
    callsign,
    origin,
    model,
    operator,
    speedText,
    altText,
    getFlagHTML,
    isGrounded,
    isMilitary,
    isSpecial,
    verticalRate,
    altitude,
    getAltitudeColor,
    getOperatorLogo,
  });
}

export function planeTooltipLeft(
  id: string,
  callsign: string,
  origin: string,
  model: string,
  operator: string,
  speedText: string,
  altText: string,
  getFlagHTML: (origin: string) => string,
  isNew: boolean,
  isGrounded: boolean,
  isMilitary: boolean,
  isSpecial: boolean,
  verticalRate: number | null,
  altitude?: number | null,
  getAltitudeColor?: (alt: number) => string,
  getOperatorLogo?: (plane: {
    operator: string;
    country: string;
    isMilitary: boolean;
  }) => string,
  distanceText?: string,
): string {
  const tooltip = planeTooltip(
    id,
    callsign,
    origin,
    model,
    operator,
    speedText,
    altText,
    getFlagHTML,
    isNew,
    isGrounded,
    isMilitary,
    isSpecial,
    verticalRate,
    altitude,
    getAltitudeColor,
    getOperatorLogo,
    distanceText,
  );
  return `<span class="plane-tooltip-left-variant">${tooltip}</span>`;
}
