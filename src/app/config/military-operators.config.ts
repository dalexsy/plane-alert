/**
 * Default military operator display names by country
 * Used as fallback when database operator field is empty
 */
export const MILITARY_OPERATOR_NAMES: Record<string, string> = {
  de: 'Luftwaffe',
  us: 'US Air Force',
  gb: 'Royal Air Force',
  fr: 'French Air Force',
  ch: 'Swiss Air Force',
  ua: 'Ukrainian Air Force',
  it: 'Italian Air Force',
  pl: 'Polish Air Force',
  cz: 'Czech Air Force',
  kw: 'Kuwait Air Force',
  ca: 'Royal Canadian Air Force',
  no: 'Norwegian Armed Forces',
  sg: 'Republic of Singapore Air Force',
};

/**
 * Get default military operator name by country code
 * Returns null if no default is configured for the country
 */
export function getDefaultMilitaryOperator(
  countryCode?: string,
): string | null {
  if (!countryCode) {
    return null;
  }
  return MILITARY_OPERATOR_NAMES[countryCode.toLowerCase()] ?? null;
}
