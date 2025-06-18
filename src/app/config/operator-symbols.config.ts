export interface OperatorSymbolConfig {
  key: string; // filename (without .svg)
  svgFileName: string; // actual SVG filename
  countries: string[]; // ISO2 codes
  operators?: string[]; // operator names for specific matching
}

// Centralized operator symbol configuration
export const OPERATOR_SYMBOLS: OperatorSymbolConfig[] = [
  {
    key: 'bundeswehr_kreuz',
    svgFileName: 'bundeswehr_kreuz.svg',
    countries: ['de', 'germany'],
  },
  {
    key: 'US_Air_Force',
    svgFileName: 'US_Air_Force.svg',
    countries: ['us', 'united states'],
    operators: ['united states air force', 'us air force', 'usaf'],
  },
  {
    key: 'US_Navy',
    svgFileName: 'Emblem_of_the_United_States_Navy.svg',
    countries: [],
    operators: [
      'united states navy',
      'us navy',
      'usn',
      'u.s. navy',
      'navy',
      'naval',
      'united states naval',
    ],
  },
  {
    key: 'schweizer_armee',
    svgFileName: 'schweizer_armee.svg',
    countries: ['ch', 'switzerland'],
  },
  {
    key: 'Roundel_of_the_United_Kingdom',
    svgFileName: 'Roundel_of_the_United_Kingdom.svg',
    countries: ['gb', 'great britain'],
  },
  {
    key: 'Coat_of_Arms_of_Ukraine',
    svgFileName: 'Coat_of_Arms_of_Ukraine.svg',
    countries: ['uk', 'ukraine'],
  },
];
