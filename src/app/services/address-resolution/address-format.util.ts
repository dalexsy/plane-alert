import type { GeocodeResult } from '../location-context/location-context.service';

function isHouseNumber(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\d+[A-Za-z]?([-/]\d+[A-Za-z]?)?$/.test(trimmed)) {
    return false;
  }
  const numericOnly = trimmed.replace(/[^\d]/g, '');
  if (!/[A-Za-z]/.test(trimmed) && numericOnly.length > 4) {
    return false;
  }
  return true;
}

function combineStreetAndNumber(parts: string[]): string[] {
  if (parts.length < 2) return parts;
  const [first, second, ...rest] = parts;
  const isFirstNumber = isHouseNumber(first);
  const isSecondNumber = isHouseNumber(second);
  if (
    isFirstNumber &&
    !isSecondNumber &&
    second &&
    /\p{L}/u.test(second) &&
    !/^\d/.test(second)
  ) {
    return [`${second} ${first}`, ...rest];
  }
  if (!isFirstNumber && isSecondNumber && second && /\p{L}/u.test(first)) {
    return [`${first} ${second}`, ...rest];
  }
  return parts;
}

function dedupeParts(parts: string[]): string[] {
  const seen = new Set<string>();
  return parts.filter((part) => {
    const normalized = part.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function basicFormatAddress(address: string): string {
  if (!address || address.trim() === '') return address;
  let formatted = address
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
  let parts = formatted
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  parts = combineStreetAndNumber(parts);
  parts = dedupeParts(parts);
  formatted = parts.join(', ');
  return formatted
    .toLocaleLowerCase('de-DE')
    .replace(
      /(^|[\s-])\p{L}/gu,
      (start) => start.toLocaleUpperCase('de-DE')
    )
    .replace(
      /(\d)(\p{L})\b/gu,
      (_match, number, suffix) =>
        `${number}${suffix.toLocaleUpperCase('de-DE')}`
    );
}

function cleanDisplayName(displayName: string): string {
  let formatted = displayName
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
  formatted = formatted.replace(/,\s*(\d+[A-Za-z]?)(?=,)/g, ' $1');
  let parts = formatted
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  parts = combineStreetAndNumber(parts);
  parts = dedupeParts(parts);
  return parts.join(', ');
}

export function formatResolvedAddress(
  address: string,
  geocodeResult?: GeocodeResult
): string {
  const details = geocodeResult?.addressDetails;
  if (details) {
    const parts: string[] = [];
    const seen = new Set<string>();
    const addPart = (value?: string | null) => {
      if (!value) return;
      const trimmed = value.trim();
      if (!trimmed) return;
      const normalized = trimmed.toLowerCase();
      if (seen.has(normalized)) return;
      seen.add(normalized);
      parts.push(trimmed);
    };

    const d = details as Record<string, string | undefined>;
    const roadLike =
      d['road'] ||
      d['pedestrian'] ||
      d['cycleway'] ||
      d['footway'] ||
      d['residential'];
    const houseNumber = d['house_number'];
    const streetLine = roadLike
      ? `${roadLike}${houseNumber ? ` ${houseNumber}` : ''}`
      : undefined;

    addPart(streetLine);
    addPart(d['neighbourhood']);
    addPart(d['suburb']);
    addPart(d['city_district']);
    addPart(d['county']);

    const locality =
      d['city'] ||
      d['town'] ||
      d['village'] ||
      d['municipality'] ||
      d['hamlet'];
    const postcode = d['postcode']?.trim();
    if (locality) {
      addPart(postcode ? `${postcode} ${locality}` : locality);
    } else if (postcode) {
      addPart(postcode);
    }

    const state = d['state'];
    if (state && state.toLowerCase() !== (locality || '').toLowerCase()) {
      addPart(state);
    }
    addPart(d['country']);
    if (parts.length > 0) return parts.join(', ');
  }

  if (geocodeResult?.displayName) {
    return cleanDisplayName(geocodeResult.displayName);
  }
  return basicFormatAddress(address);
}
