export function mixColorWithWhite(color: string, whiteAmount: number): string {
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);
    const mixedR = Math.round(r + (255 - r) * whiteAmount);
    const mixedG = Math.round(g + (255 - g) * whiteAmount);
    const mixedB = Math.round(b + (255 - b) * whiteAmount);
    return `rgb(${mixedR}, ${mixedG}, ${mixedB})`;
  }

  const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (hslMatch) {
    const h = parseInt(hslMatch[1]);
    const s = parseInt(hslMatch[2]);
    const l = parseInt(hslMatch[3]);
    const { r, g, b } = hslToRgb(h, s / 100, l / 100);
    const mixedR = Math.round(r + (255 - r) * whiteAmount);
    const mixedG = Math.round(g + (255 - g) * whiteAmount);
    const mixedB = Math.round(b + (255 - b) * whiteAmount);
    return `rgb(${mixedR}, ${mixedG}, ${mixedB})`;
  }

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

  return color;
}

export function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
  } else if (120 <= h && h < 180) {
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}
