import { TimezoneData } from './location-context.service';

export function parseUtcOffset(offsetString: string): number {
  if (!offsetString) return 0;
  const match = offsetString.match(/([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);
  return sign * (hours + minutes / 60);
}

export function calculateLocationDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const deltaLat = lat1 - lat2;
  const deltaLon = lon1 - lon2;
  return Math.sqrt(deltaLat * deltaLat + deltaLon * deltaLon);
}

const TIMEZONE_POINTS = [
  { lat: 51.5074, lon: -0.1278, tz: 'Europe/London' },
  { lat: 52.52, lon: 13.405, tz: 'Europe/Berlin' },
  { lat: 48.8566, lon: 2.3522, tz: 'Europe/Paris' },
  { lat: 55.7558, lon: 37.6173, tz: 'Europe/Moscow' },
  { lat: 40.7128, lon: -74.006, tz: 'America/New_York' },
  { lat: 41.8781, lon: -87.6298, tz: 'America/Chicago' },
  { lat: 39.7392, lon: -104.9903, tz: 'America/Denver' },
  { lat: 34.0522, lon: -118.2437, tz: 'America/Los_Angeles' },
  { lat: 35.6762, lon: 139.6503, tz: 'Asia/Tokyo' },
  { lat: 39.9042, lon: 116.4074, tz: 'Asia/Shanghai' },
  { lat: 28.6139, lon: 77.209, tz: 'Asia/Kolkata' },
  { lat: 25.2048, lon: 55.2708, tz: 'Asia/Dubai' },
  { lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney' },
  { lat: -37.8136, lon: 144.9631, tz: 'Australia/Melbourne' },
  { lat: -23.5505, lon: -46.6333, tz: 'America/Sao_Paulo' },
  { lat: -34.6118, lon: -58.396, tz: 'America/Argentina/Buenos_Aires' },
  { lat: -26.2041, lon: 28.0473, tz: 'Africa/Johannesburg' },
  { lat: 30.0444, lon: 31.2357, tz: 'Africa/Cairo' },
];

export function findNearestTimezone(lat: number, lon: number): string | null {
  let nearest: string | null = null;
  let minDistance = Infinity;
  for (const point of TIMEZONE_POINTS) {
    const distance = calculateLocationDistance(lat, lon, point.lat, point.lon);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = point.tz;
    }
  }
  return minDistance < 20 ? nearest : null;
}

export function resolveTimezoneData(lat: number, lon: number): TimezoneData {
  try {
    const nearestTimezone = findNearestTimezone(lat, lon);
    if (nearestTimezone) {
      const tempDate = new Date();
      const utc1 = tempDate.getTime() + tempDate.getTimezoneOffset() * 60000;
      const utc2 = new Date(utc1);
      const timeInZone = new Intl.DateTimeFormat('en-CA', {
        timeZone: nearestTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(tempDate);
      const zonedTime = new Date(
        timeInZone.replace(
          /(\d{4})-(\d{2})-(\d{2}), (\d{2}):(\d{2}):(\d{2})/,
          '$1-$2-$3T$4:$5:$6'
        )
      );
      const offsetHours = (zonedTime.getTime() - utc2.getTime()) / (1000 * 60 * 60);
      return { timezone: nearestTimezone, utcOffset: offsetHours, dst: false };
    }
  } catch {
    /* fallback below */
  }
  let estimatedOffset = lon / 15;
  estimatedOffset = Math.round(estimatedOffset * 2) / 2;
  estimatedOffset = Math.max(-12, Math.min(14, estimatedOffset));
  return {
    timezone: `UTC${estimatedOffset >= 0 ? '+' : ''}${estimatedOffset}`,
    utcOffset: estimatedOffset,
    dst: false,
  };
}

export function getCurrentTimeForTimezone(timezone: TimezoneData | null): Date {
  if (!timezone) return new Date();
  if (timezone.timezone?.includes('/')) {
    try {
      const now = new Date();
      const timeString = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);
      const [datePart, timePart] = timeString.split(', ');
      return new Date(`${datePart}T${timePart}`);
    } catch {
      /* offset fallback */
    }
  }
  const now = new Date();
  const browserOffsetMinutes = now.getTimezoneOffset();
  const locationOffsetMinutes = timezone.utcOffset * 60;
  const timeDifferenceMs = (locationOffsetMinutes + browserOffsetMinutes) * 60000;
  return new Date(now.getTime() + timeDifferenceMs);
}

export async function geocodeAddressRemote(address: string): Promise<{
  lat: number;
  lon: number;
  displayName?: string;
  addressDetails?: Record<string, string>;
}> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    address
  )}&format=json&limit=1`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'PlaneAlert/1.0' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const data = await response.json();
  if (data.length === 0) throw new Error('No results found for address');
  const result = data[0];
  return {
    lat: parseFloat(result.lat),
    lon: parseFloat(result.lon),
    displayName: result.display_name,
    addressDetails: result.address,
  };
}
