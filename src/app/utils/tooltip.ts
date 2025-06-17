// Helper function to mix a color with white for better contrast
import { TextUtils } from './text-utils';

function mixColorWithWhite(color: string, whiteAmount: number): string {
  // Parse RGB values from the color string
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);

    // Mix with white
    const mixedR = Math.round(r + (255 - r) * whiteAmount);
    const mixedG = Math.round(g + (255 - g) * whiteAmount);
    const mixedB = Math.round(b + (255 - b) * whiteAmount);

    return `rgb(${mixedR}, ${mixedG}, ${mixedB})`;
  }

  // Parse HSL values from the color string
  const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (hslMatch) {
    const h = parseInt(hslMatch[1]);
    const s = parseInt(hslMatch[2]);
    const l = parseInt(hslMatch[3]);

    // Convert HSL to RGB first
    const { r, g, b } = hslToRgb(h, s / 100, l / 100);

    // Mix with white
    const mixedR = Math.round(r + (255 - r) * whiteAmount);
    const mixedG = Math.round(g + (255 - g) * whiteAmount);
    const mixedB = Math.round(b + (255 - b) * whiteAmount);

    return `rgb(${mixedR}, ${mixedG}, ${mixedB})`;
  }

  // If it's a hex color, convert it
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    const mixedR = Math.round(r + (255 - r) * whiteAmount);
    const mixedG = Math.round(g + (255 - g) * whiteAmount);
    const mixedB = Math.round(b + (255 - b) * whiteAmount);

    return `rgb(${mixedR}, ${mixedG}, ${mixedB})`;
  }

  // Fallback: return original color
  return color;
}

// Helper function to convert HSL to RGB
function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

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
  getAltitudeColor?: (alt: number) => string
): string {
  // Single place to control white mixing amount for both altitude text and arrow
  const WHITE_MIX_AMOUNT = 0.3;

  // Truncate operator text to 30 characters with ellipsis if longer
  const truncatedOperator = TextUtils.truncateOperator(operator);

  // Pre-calculate mixed altitude color if available
  let mixedAltitudeColor: string | undefined;
  if (altitude != null && getAltitudeColor) {
    mixedAltitudeColor = mixColorWithWhite(
      getAltitudeColor(altitude),
      WHITE_MIX_AMOUNT
    );
  }

  // Display 'Pending' when no valid callsign provided
  const displayCallsign =
    callsign && callsign.trim().length >= 3
      ? callsign
      : `<span class="none-callsign">Pending</span>`; // Compute vertical rate arrow
  let verticalRateSpan = '';
  if (verticalRate !== null) {
    const maxRate = 20; // m/s for normalization
    const maxAngle = 45; // degrees max tilt
    const clamped = Math.max(-maxRate, Math.min(maxRate, verticalRate));
    const absClamped = Math.abs(clamped);
    const angle = (absClamped / maxRate) * maxAngle;
    // Choose upward or downward Material symbol based on sign
    const iconName = verticalRate >= 0 ? 'arrow_upward' : 'arrow_downward'; // Apply altitude color to the arrow if available
    let arrowStyle = `transform:rotate(${angle}deg);`;
    if (mixedAltitudeColor) {
      arrowStyle += `color: ${mixedAltitudeColor};`;
    }
    verticalRateSpan = `<span class="material-symbols-sharp vertical-rate" style="${arrowStyle}">${iconName}</span>`;
  }
  // Main row: callsign with flag and either operator or speed/alt
  const mainRow = `
  <span class="tooltip-row">
    ${getFlagHTML(origin)}
      <a class="callsign-text" href="https://globe.adsbexchange.com/?icao=${id}" target="_blank" title="Open in ADS-B Exchange" onclick="event.stopPropagation()">${
    callsign && callsign.trim().length >= 3
      ? callsign
      : '<span class="none-callsign">Pending</span>'
  }</a>
      ${
        isMilitary
          ? '<span class="material-symbols-sharp icon small military-star-tooltip">star</span>'
          : ''
      }${
    isSpecial
      ? '<span class="material-symbols-sharp icon small special-star-tooltip">favorite</span>'
      : ''
  }    ${
    truncatedOperator
      ? `<span class="divider">•</span> <span class="aircraft-operator">${truncatedOperator}</span>`
      : /* ...existing speed/alt logic... */ ''
  }
  </span>`; // Info row: include speed/alt/model when operator present, else only model
  const infoItems: string[] = [];
  if (truncatedOperator) {
    // Show model first, then speed, then altitude+arrow
    if (model) infoItems.push(`<span class="aircraft-model">${model}</span>`);
    if (speedText) infoItems.push(`<span class="velocity">${speedText}</span>`);
    if (isGrounded) {
      infoItems.push(`<span class="altitude">On ground</span>`);
    } else if (altText || verticalRateSpan) {
      let styledAltText = altText;
      if (mixedAltitudeColor && altText) {
        styledAltText = `<span style=\"color: ${mixedAltitudeColor};\">${altText}</span>`;
      }
      infoItems.push(
        `<span class=\"altitude\">${styledAltText}${verticalRateSpan}</span>`
      );
    }
  } else {
    // No operator: only show model
    if (model) infoItems.push(`<span class="aircraft-model">${model}</span>`);
  }
  const infoRow = infoItems.length
    ? `
  <span class="tooltip-row">
    ${infoItems
      .map((item, i) => (i > 0 ? '<span class="divider">•</span>' : '') + item)
      .join('')}
  </span>`
    : '';

  // Combine rows
  return `<span class="plane-tooltip-link tooltip-follow-wrapper" data-icao="${id}" onclick="(function(e){window.dispatchEvent(new CustomEvent('plane-tooltip-follow',{detail:{icao:'${id}'}}));e.stopPropagation();e.preventDefault();})(event)">${mainRow}${infoRow}</span>`;
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
  getAltitudeColor?: (alt: number) => string
): string {
  // Use the same logic as the regular tooltip but with different styling
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
    getAltitudeColor
  );

  // Wrap with left-side variant class
  return `<span class="plane-tooltip-left-variant">${tooltip}</span>`;
}
