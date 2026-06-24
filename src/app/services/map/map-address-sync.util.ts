/** Detect saved address / coordinate mismatches (e.g. "New York" with Berlin coords). */
export function addressLooksWrongForCoordinates(
  address: string,
  lat: number,
  lon: number
): boolean {
  const addressLower = address.toLowerCase();
  const isEurope = lat > 35 && lat < 70 && lon > -10 && lon < 40;
  const isNorthAmerica = lat > 25 && lat < 50 && lon > -125 && lon < -65;

  if (
    isEurope &&
    (addressLower.includes('new york') ||
      addressLower.includes('united states') ||
      addressLower.includes('canada') ||
      addressLower.includes('mexico'))
  ) {
    return true;
  }
  if (
    isNorthAmerica &&
    (addressLower.includes('berlin') ||
      addressLower.includes('germany') ||
      addressLower.includes('france') ||
      addressLower.includes('italy'))
  ) {
    return true;
  }
  return false;
}
