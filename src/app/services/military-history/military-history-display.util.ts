import { getDefaultMilitaryOperator } from '../../config/military-operators.config';
import type { MilitaryHistorySighting } from './military-history.service';

export type HistorySortField =
  | 'lastSeen'
  | 'model'
  | 'country'
  | 'operator'
  | 'sightingCount'
  | 'callsign';
export type HistorySortDirection = 'asc' | 'desc';

export function filterMilitaryHistory(
  history: MilitaryHistorySighting[],
  searchQuery: string,
): MilitaryHistorySighting[] {
  if (!searchQuery) return [...history];
  const query = searchQuery.toLowerCase();
  return history.filter((s) => {
    const searchable = [
      s.icao,
      s.callsign,
      s.model,
      s.operator,
      s.country,
      s.registration,
      s.notifiedDeviceName,
      s.notifiedDeviceNames?.join(' '),
      s.notificationLocation?.address,
    ]
      .filter((v) => v)
      .join(' ')
      .toLowerCase();
    return searchable.includes(query);
  });
}

export function sortMilitaryHistory(
  history: MilitaryHistorySighting[],
  sortField: HistorySortField,
  sortDirection: HistorySortDirection,
): MilitaryHistorySighting[] {
  const sorted = [...history];
  sorted.sort((a, b) => {
    let aVal: string | number = '';
    let bVal: string | number = '';
    switch (sortField) {
      case 'lastSeen':
        aVal = a.lastSeen;
        bVal = b.lastSeen;
        break;
      case 'callsign':
        aVal = a.callsign || '';
        bVal = b.callsign || '';
        break;
      case 'model':
        aVal = a.model || '';
        bVal = b.model || '';
        break;
      case 'country':
        aVal = a.country || '';
        bVal = b.country || '';
        break;
      case 'operator':
        aVal = a.operator || '';
        bVal = b.operator || '';
        break;
      case 'sightingCount':
        aVal = a.sightingCount;
        bVal = b.sightingCount;
        break;
    }
    if (typeof aVal === 'string') {
      const cmp = aVal.localeCompare(String(bVal));
      return sortDirection === 'asc' ? cmp : -cmp;
    }
    const cmp = Number(aVal) - Number(bVal);
    return sortDirection === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

export function formatHistoryDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor(
    (nowDay.getTime() - dateDay.getTime()) / (1000 * 60 * 60 * 24),
  );
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  if (diffDays === 0) return `Today, ${timeStr}`;
  if (diffDays === 1) return `Yesterday, ${timeStr}`;
  if (diffDays < 7) {
    return `${date.toLocaleDateString('en-US', { weekday: 'short' })}, ${timeStr}`;
  }
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${timeStr}`;
}

export function getOperatorDisplayName(sighting: MilitaryHistorySighting): string {
  if (sighting.operator?.trim()) return sighting.operator;
  return getDefaultMilitaryOperator(sighting.country) || '—';
}

export function getBingSearchQuery(sighting: MilitaryHistorySighting): string {
  return encodeURIComponent(
    [sighting.model || '', getOperatorDisplayName(sighting), 'aircraft']
      .filter(Boolean)
      .join(' '),
  );
}

export function isGenericHistoryModel(model?: string): boolean {
  return !model || ['Unknown', 'Helicopter', 'Glider', 'Ultralight'].includes(model);
}

function getCondensedLocation(address: string): string {
  const cleanedParts = [
    ...new Set(
      address
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => !/^\d+[A-Za-z-]*$/.test(part))
        .filter((part) => !/^\d{4,6}$/.test(part))
        .filter(
          (part) =>
            !/\b(street|straße|strasse|road|avenue|boulevard|drive|lane)\b/i.test(
              part,
            ),
        )
        .filter(
          (part) =>
            !/\b(county|state district|administrative area|region)\b/i.test(part),
        ),
    ),
  ];
  if (cleanedParts.length <= 3) return cleanedParts.join(', ');
  if (cleanedParts.length >= 5) {
    return [cleanedParts[cleanedParts.length - 4], ...cleanedParts.slice(-3)].join(', ');
  }
  return cleanedParts.slice(-3).join(', ');
}

function formatDeviceName(deviceName: string): string {
  return deviceName
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getNotificationLocationDisplay(sighting: MilitaryHistorySighting): string {
  const location = sighting.notificationLocation;
  const address = location?.address?.trim();
  // Never show raw lat/lon to people — coordinates are not human-readable.
  if (address && !/^-?\d{1,3}\.\d+[,/\s]\s*-?\d{1,3}\.\d+$/.test(address)) {
    return getCondensedLocation(address);
  }
  return 'Location unavailable';
}

export function getNotificationSourceLabel(sighting: MilitaryHistorySighting): string {
  const locationLabel = getNotificationLocationDisplay(sighting);
  if ((sighting.notifiedDeviceCount || 0) > 1) {
    return `${sighting.notifiedDeviceCount} devices · ${locationLabel}`;
  }
  return sighting.notifiedDeviceName
    ? `${formatDeviceName(sighting.notifiedDeviceName)} · ${locationLabel}`
    : locationLabel;
}