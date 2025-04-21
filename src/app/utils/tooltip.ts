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
  verticalRate: number | null
): string {
  // Display 'Pending' when no valid callsign provided
  const displayCallsign =
    callsign && callsign.trim().length >= 3
      ? callsign
      : `<span class="none-callsign">Pending</span>`;
  // Compute vertical rate arrow
  let verticalRateSpan = '';
  if (verticalRate !== null) {
    const maxRate = 20; // m/s for normalization
    const maxAngle = 45; // degrees max tilt
    const clamped = Math.max(-maxRate, Math.min(maxRate, verticalRate));
    const absClamped = Math.abs(clamped);
    const angle = (absClamped / maxRate) * maxAngle;
    // Choose upward or downward Material symbol based on sign
    const iconName = verticalRate >= 0 ? 'arrow_upward' : 'arrow_downward';
    verticalRateSpan = `<span class="material-symbols-sharp vertical-rate" title="Vertical Rate: ${verticalRate.toFixed(
      1
    )} m/s" style=";transform:rotate(${angle}deg);">${iconName}</span>`;
  }
  // Remove the status classes from the inner link as they should only be on the parent
  return `<a href="https://globe.adsbexchange.com/?icao=${id}" target="_blank" rel="noopener noreferrer" class="plane-tooltip-link">
    ${getFlagHTML(origin)} <strong>${displayCallsign}${
    isMilitary
      ? '<span class="material-symbols-sharp icon small military-star-tooltip">star</span>'
      : ''
  }</strong>
    ${
      model
        ? ` <span class="altitude"><span class="divider">•</span> <span class="aircraft-model">${model}</span>`
        : ''
    }
    ${
      speedText
        ? `<span class="velocity"><span class="divider">•</span> ${speedText}</span>`
        : ''
    }
    ${
      altText || verticalRateSpan
        ? `<span class="altitude"><span class="divider">•</span> ${altText}${verticalRateSpan}</span>`
        : ''
    }
    ${operator ? `<span class="aircraft-operator">${operator}</span>` : ''}
  </a>`;
}
