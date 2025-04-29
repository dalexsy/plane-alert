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
  // Main row: callsign with flag and either operator or speed/alt
  const mainRow = `
  <span class="tooltip-row">
    ${getFlagHTML(origin)}
    <strong>
      <span class="callsign-text tooltip-follow-callsign" data-icao="${id}">${displayCallsign}</span>
      ${
        isMilitary
          ? '<span class="material-symbols-sharp icon small military-star-tooltip">star</span>'
          : ''
      }${
    isSpecial
      ? '<span class="material-symbols-sharp icon small special-star-tooltip">favorite</span>'
      : ''
  }
    </strong>
    ${
      operator
        ? `<span class="divider">•</span> <span class="aircraft-operator">${operator}</span>`
        : speedText || altText || verticalRateSpan || isGrounded
        ? (() => {
            const parts: string[] = [];
            if (speedText) {
              parts.push(`<span class="velocity">${speedText}</span>`);
            }
            if (isGrounded) {
              parts.push(`<span class="altitude">On ground</span>`);
            } else if (altText || verticalRateSpan) {
              parts.push(
                `<span class="altitude">${altText}${verticalRateSpan}</span>`
              );
            }
            // Join with dividers
            return `<span class="divider">•</span>${parts.join(
              '<span class="divider">•</span>'
            )}`;
          })()
        : ''
    }
  </span>`;

  // Info row: include speed/alt/model when operator present, else only model
  const infoItems: string[] = [];
  if (operator) {
    // Show model first, then speed, then altitude+arrow
    if (model) infoItems.push(`<span class="aircraft-model">${model}</span>`);
    if (speedText) infoItems.push(`<span class="velocity">${speedText}</span>`);
    if (isGrounded) {
      infoItems.push(`<span class="altitude">On ground</span>`);
    } else if (altText || verticalRateSpan) {
      infoItems.push(
        `<span class="altitude">${altText}${verticalRateSpan}</span>`
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
  return `<span class="plane-tooltip-link tooltip-follow-wrapper" data-icao="${id}" onclick="(function(e){console.debug('[TOOLTIP] Clicked tooltip for ICAO:', '${id}', 'event target:', e.target);if(e.target.closest('.callsign-text')){console.debug('[TOOLTIP] Dispatching follow event for', '${id}');window.dispatchEvent(new CustomEvent('plane-tooltip-follow',{detail:{icao:'${id}'}}));e.stopPropagation();e.preventDefault();}else{console.debug('[TOOLTIP] Ignored click, not on callsign.');}})(event)">${mainRow}${infoRow}</span>`;
}
