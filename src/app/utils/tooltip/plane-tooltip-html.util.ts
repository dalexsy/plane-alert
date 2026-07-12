import { TextUtils } from '../text-utils/text-utils';
import { mixColorWithWhite } from './tooltip-color.util';

const WHITE_MIX_AMOUNT = 0.3;

export function buildVerticalRateSpan(
  verticalRate: number | null,
  mixedAltitudeColor?: string,
): string {
  if (verticalRate === null) {
    return '';
  }

  const maxRate = 20;
  const maxAngle = 45;
  const clamped = Math.max(-maxRate, Math.min(maxRate, verticalRate));
  const angle = (Math.abs(clamped) / maxRate) * maxAngle;
  const iconName = verticalRate >= 0 ? 'arrow_upward' : 'arrow_downward';
  let arrowStyle = `transform:rotate(${angle}deg);`;
  if (mixedAltitudeColor) {
    arrowStyle += `color: ${mixedAltitudeColor};`;
  }
  return `<span class="material-symbols-sharp vertical-rate" style="${arrowStyle}">${iconName}</span>`;
}

function buildSpeedAltItems(
  speedText: string,
  altText: string,
  verticalRateSpan: string,
  isGrounded: boolean,
  mixedAltitudeColor?: string,
): string[] {
  const items: string[] = [];
  if (speedText) {
    items.push(`<span class="velocity">${speedText}</span>`);
  }
  if (isGrounded) {
    items.push(`<span class="altitude">On ground</span>`);
  } else if (altText || verticalRateSpan) {
    let styledAltText = altText;
    if (mixedAltitudeColor && altText) {
      styledAltText = `<span style="color: ${mixedAltitudeColor};">${altText}</span>`;
    }
    items.push(`<span class="altitude">${styledAltText}${verticalRateSpan}</span>`);
  }
  return items;
}

export function buildPlaneTooltipHtml(args: {
  id: string;
  callsign: string;
  origin: string;
  model: string;
  operator: string;
  speedText: string;
  altText: string;
  getFlagHTML: (origin: string) => string;
  isGrounded: boolean;
  isMilitary: boolean;
  isSpecial: boolean;
  verticalRate: number | null;
  altitude?: number | null;
  getAltitudeColor?: (alt: number) => string;
  getOperatorLogo?: (plane: {
    operator: string;
    country: string;
    isMilitary: boolean;
  }) => string;
}): string {
  const truncatedOperator = TextUtils.truncateOperator(args.operator);
  let mixedAltitudeColor: string | undefined;
  if (args.altitude != null && args.getAltitudeColor) {
    mixedAltitudeColor = mixColorWithWhite(
      args.getAltitudeColor(args.altitude),
      WHITE_MIX_AMOUNT,
    );
  }

  const verticalRateSpan = buildVerticalRateSpan(
    args.verticalRate,
    mixedAltitudeColor,
  );
  const operatorLogo = args.getOperatorLogo
    ? args.getOperatorLogo({
        operator: args.operator,
        country: args.origin,
        isMilitary: args.isMilitary,
      })
    : '';

  const callsignHtml =
    args.callsign && args.callsign.trim().length >= 3
      ? args.callsign
      : '<span class="none-callsign">Pending</span>';

  const mainRowExtras = truncatedOperator
    ? `<span class="divider">•</span> <span class="aircraft-operator">${truncatedOperator}</span>`
    : (() => {
        const items = buildSpeedAltItems(
          args.speedText,
          args.altText,
          verticalRateSpan,
          args.isGrounded,
          mixedAltitudeColor,
        );
        return items.length
          ? `<span class="divider">•</span>${items
              .map(
                (item, i) =>
                  (i > 0 ? '<span class="divider">•</span>' : '') + item,
              )
              .join('')}`
          : '';
      })();

  const mainRow = `
  <span class="tooltip-row">
    ${operatorLogo}${args.getFlagHTML(args.origin)}
      <a class="callsign-text" href="https://globe.adsbexchange.com/?icao=${args.id}" target="_blank" title="Open in ADS-B Exchange" onclick="event.stopPropagation()">${callsignHtml}</a>
      ${
        args.isMilitary
          ? '<span class="material-symbols-sharp icon small military-star-tooltip">star</span>'
          : ''
      }${
        args.isSpecial
          ? '<span class="material-symbols-sharp icon small special-star-tooltip">favorite</span>'
          : ''
      }${mainRowExtras}
  </span>`;

  const infoItems: string[] = [];
  if (truncatedOperator) {
    if (args.model) {
      infoItems.push(`<span class="aircraft-model">${args.model}</span>`);
    }
    infoItems.push(
      ...buildSpeedAltItems(
        args.speedText,
        args.altText,
        verticalRateSpan,
        args.isGrounded,
        mixedAltitudeColor,
      ),
    );
  } else if (args.model) {
    infoItems.push(`<span class="aircraft-model">${args.model}</span>`);
  }

  const infoRow = infoItems.length
    ? `
  <span class="tooltip-row">
    ${infoItems
      .map((item, i) => (i > 0 ? '<span class="divider">•</span>' : '') + item)
      .join('')}
  </span>`
    : '';

  return `<span class="plane-tooltip-link tooltip-follow-wrapper" data-icao="${args.id}" onclick="(function(e){window.dispatchEvent(new CustomEvent('plane-tooltip-follow',{detail:{icao:'${args.id}'}}));e.stopPropagation();e.preventDefault();})(event)">${mainRow}${infoRow}</span>`;
}
