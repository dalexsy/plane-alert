import { adsbPointProxyUrl } from '../../config/planes-api.config';

export async function fetchPlaneDataFromApi(
  centerLat: number,
  centerLon: number,
  radiusKm: number,
): Promise<any[]> {
  try {
    const params = new URLSearchParams({
      lat: String(centerLat),
      lon: String(centerLon),
      radiusKm: String(radiusKm),
    });
    const response = await fetch(`${adsbPointProxyUrl}?${params}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn(`adsbPointProxy HTTP ${response.status}: ${body.slice(0, 120)}`);
      throw new Error(`adsbPointProxy HTTP ${response.status}`);
    }
    return (await response.json()).ac || [];
  } catch (err) {
    console.warn('ADS-B API unavailable, using cached aircraft data:', err);
    return [];
  }
}
