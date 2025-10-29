export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function computeBearing(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRad(fromLat);
  const lat2 = toRad(toLat);
  const dLon = toRad(toLon - fromLon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  let bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

export function getCardinalDirection(bearing: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

export function getArrowForDirection(direction: string): string {
  const arrows: { [key: string]: string } = {
    N: '↑',
    NE: '↗',
    E: '→',
    SE: '↘',
    S: '↓',
    SW: '↙',
    W: '←',
    NW: '↖',
  };
  return arrows[direction] || '';
}

export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<string> {
  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(
      `/nominatim/reverse?format=json&lat=${lat}&lon=${lon}`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'PlaneAlert/1.0' }
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  } catch (error: any) {
    // Specific handling for CORS/network errors
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.warn('Reverse geocoding blocked by CORS policy or network error. Using coordinates fallback.');
    } else if (error.name === 'AbortError') {
      console.warn('Reverse geocoding request timed out. Using coordinates fallback.');
    } else {
      console.warn('Reverse geocoding failed:', error);
    }
    
    // Fallback to formatted coordinates
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
}
