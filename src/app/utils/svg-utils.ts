export function ensureStripedPattern(
  svg: SVGSVGElement,
  patternId: string,
  fillColor: string = 'cyan',
  fillOpacity: number = 0.5
): void {
  if (!svg.querySelector(`#${patternId}`)) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const pattern = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'pattern'
    );
    pattern.setAttribute('id', patternId);
    pattern.setAttribute('width', '4');
    pattern.setAttribute('height', '4');
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('patternTransform', 'rotate(45)');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '2');
    rect.setAttribute('height', '4');
    rect.setAttribute('fill', fillColor);
    rect.setAttribute('fill-opacity', fillOpacity.toString());

    pattern.appendChild(rect);
    defs.appendChild(pattern);
    svg.insertBefore(defs, svg.firstChild);
  }
}

/**
 * Creates an SVG string from a path data string and dimensions.
 * @param pathData The SVG path data (the 'd' attribute).
 * @param size The [width, height] of the SVG viewBox.
 * @returns A string containing the complete SVG element.
 */
export function svgPathToSvg(pathData: string, size: [number, number]): string {
  const [width, height] = size;

  // IMPROVED: Add proper centering attributes for consistent positioning
  // Using preserveAspectRatio="xMidYMid meet" ensures that the SVG is centered
  // within the container regardless of its dimensions
  return `<svg xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 ${width} ${height}" 
            width="100%" 
            height="100%" 
            preserveAspectRatio="xMidYMid meet">
            <path d="${pathData}" fill="currentColor" />
          </svg>`;
}
