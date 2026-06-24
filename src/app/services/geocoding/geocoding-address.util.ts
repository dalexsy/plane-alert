export interface ReverseGeocodeResponse {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  countryName?: string;
  country?: string;
  localityInfo?: {
    informative?: Array<{ name?: string | null }>;
    administrative?: Array<{ name?: string | null }>;
  };
  address?: {
    road?: string | null;
    house_number?: string | null;
    pedestrian?: string | null;
    path?: string | null;
    neighbourhood?: string | null;
    suburb?: string | null;
    city_district?: string | null;
    city?: string | null;
    town?: string | null;
    village?: string | null;
    municipality?: string | null;
    hamlet?: string | null;
    borough?: string | null;
    region?: string | null;
    state?: string | null;
    postcode?: string | null;
    country?: string | null;
  };
  continent?: string;
}

export function buildAddressString(response: ReverseGeocodeResponse): string | null {
  const parts: string[] = [];
  const seen = new Set<string>();
  const genericTerms = new Set(['nearby area', 'unnamed road', 'unknown', 'general', 'world', 'earth', 'continent']);
  const normalizeKey = (value: string) =>
    value.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const isGeneric = (candidate: string) => {
    const trimmed = candidate.trim();
    if (!trimmed) return true;
    const normalized = normalizeKey(trimmed);
    if (genericTerms.has(normalized)) return true;
    if (normalized === response.continent?.toLowerCase()) return true;
    const continentTokens = ['europe', 'asia', 'africa', 'australia', 'oceania', 'antarctica'];
    if (continentTokens.some((token) => normalized === token || normalized.startsWith(`${token}/`))) return true;
    if (normalized.endsWith(' continent') || normalized.endsWith(' region')) return true;
    return false;
  };
  const addPart = (raw?: string | null) => {
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed || isGeneric(trimmed)) return;
    const key = normalizeKey(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    parts.push(trimmed);
  };
  const address = response.address || {};
  const administrative = response.localityInfo?.administrative ?? [];
  const getAdministrativeFromEnd = (offset: number): string | undefined => {
    if (!administrative.length) return undefined;
    const index = administrative.length - 1 - offset;
    if (index < 0 || index >= administrative.length) return undefined;
    const name = administrative[index]?.name?.trim();
    if (!name || isGeneric(name)) return undefined;
    return name;
  };
  const pickFirstValid = (candidates: Array<string | null | undefined>): string | undefined => {
    for (const candidate of candidates) {
      if (!candidate) continue;
      const trimmed = candidate.trim();
      if (!trimmed || isGeneric(trimmed)) continue;
      return trimmed;
    }
    return undefined;
  };
  const road = pickFirstValid([address.road, address.pedestrian, address.path, address.neighbourhood, address.hamlet]);
  const houseNumber = address.house_number?.trim();
  if (road) addPart(houseNumber ? `${road} ${houseNumber}` : road);
  else if (houseNumber) addPart(houseNumber);
  let locality = pickFirstValid([
    address.city, address.town, address.village, address.municipality,
    response.city, response.locality, getAdministrativeFromEnd(0),
  ]);
  let subLocality = pickFirstValid([
    address.suburb, address.city_district, address.borough, address.neighbourhood,
    getAdministrativeFromEnd(locality ? 1 : 0),
  ]);
  if (locality && subLocality && normalizeKey(locality) === normalizeKey(subLocality)) subLocality = undefined;
  addPart(subLocality);
  addPart(locality);
  addPart(pickFirstValid([address.state, address.region, response.principalSubdivision, getAdministrativeFromEnd(locality ? 1 : 0), getAdministrativeFromEnd(1)]));
  addPart(pickFirstValid([address.country, response.countryName, response.country, getAdministrativeFromEnd(administrative.length - 1)]));
  if (!parts.length) addPart(address.postcode);
  const finalParts: string[] = [];
  const finalSeen = new Set<string>();
  for (const part of parts) {
    const key = normalizeKey(part);
    if (!part || isGeneric(part) || finalSeen.has(key)) continue;
    finalSeen.add(key);
    finalParts.push(part);
  }
  return finalParts.length > 0 ? finalParts.join(', ') : null;
}
