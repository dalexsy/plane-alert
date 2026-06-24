export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function computeBearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const CARDINALS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const ARROWS: Record<string, string> = {
  N: '↑', NNE: '↗', NE: '↗', ENE: '↗', E: '→', ESE: '↘', SE: '↘', SSE: '↘', S: '↓',
  SSW: '↙', SW: '↙', WSW: '↙', W: '←', WNW: '↖', NW: '↖', NNW: '↖',
};

export function bearingToCardinal(bearing: number): string {
  return CARDINALS[Math.round(bearing / 22.5) % 16];
}

export function cardinalToArrow(cardinal: string): string {
  return ARROWS[cardinal] || '↑';
}

export type UnknownCountryEntry = {
  icao: string;
  registration: string;
  operator: string;
  rawCountry: string;
  callsign: string;
  detectedCountry: string;
  isMilitary: boolean;
};

export class UnknownCountryLogger {
  private logged = new Set<string>();
  private batch: UnknownCountryEntry[] = [];
  private lastLogTime = 0;

  track(entry: UnknownCountryEntry): void {
    const { icao, detectedCountry, isMilitary } = entry;
    if (
      (detectedCountry === 'Unknown' || (isMilitary && detectedCountry !== 'Unknown')) &&
      !this.logged.has(icao)
    ) {
      this.batch.push(entry);
      this.logged.add(icao);
    }
    const now = Date.now();
    if (now - this.lastLogTime > 30000 && this.batch.length > 0) {
      this.batch.forEach((aircraft) => {
        const milFlag = aircraft.isMilitary ? '[MIL]' : '';
        console.log(`Unknown country aircraft ${milFlag}:`, aircraft);
      });
      this.batch = [];
      this.lastLogTime = now;
    }
  }
}
