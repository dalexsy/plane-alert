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
