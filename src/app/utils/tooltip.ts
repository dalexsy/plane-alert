export function planeTooltip(
  id: string,
  callsign: string,
  origin: string,
  model: string,
  operator: string,
  combined: string,
  getFlagHTML: (origin: string) => string,
  isNew: boolean,
  isGrounded: boolean,
  isMilitary: boolean
): string {
  // Display 'Pending' when no valid callsign provided
  const displayCallsign = callsign && callsign.trim().length >= 3
    ? callsign
    : `<span class="none-callsign">Pending</span>`;
  // Remove the status classes from the inner link as they should only be on the parent
  return `<a href="https://globe.adsbexchange.com/?icao=${id}" target="_blank" rel="noopener noreferrer" class="plane-tooltip-link">
    ${getFlagHTML(origin)} <strong>${displayCallsign}${
    isMilitary
      ? '<span class="material-symbols-sharp icon small military-star-tooltip">star</span>'
      : ''
  }</strong>
    ${model ? `<span class="aircraft-model">${model}</span>` : ''}
    <span class="velocity">${combined}</span>
    ${operator ? `<span class="aircraft-operator">${operator}</span>` : ''}
  </a>`;
}
