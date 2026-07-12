export interface GeocodeResult {
  lat: number;
  lon: number;
}

export function forwardGeocodeAddress(address: string): Promise<GeocodeResult | null> {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch(`/nominatim/search?format=json&q=${encodeURIComponent(address)}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'PlaneAlert/1.0' },
    })
      .then((res) => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.length) {
          resolve({
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon),
          });
        } else {
          console.warn('No results found for address:', address);
          resolve(null);
        }
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        if (
          error instanceof TypeError &&
          error.message.includes('Failed to fetch')
        ) {
          console.warn(
            'Address search blocked by CORS policy or network error:',
            address,
          );
        } else if (error.name === 'AbortError') {
          console.warn('Address search timed out:', address);
        } else {
          console.warn('Address search failed:', error);
        }
        resolve(null);
      });
  });
}

export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
