export interface OperatorSymbolConfig {
  key: string; // filename (without .svg)
  countries: string[]; // ISO2 codes
  operators?: string[]; // operator names for specific matching
}

// Centralized operator symbol configuration
export const OPERATOR_SYMBOLS: OperatorSymbolConfig[] = [
  {
    key: 'bundeswehr_kreuz',
    countries: ['de', 'germany'],
  },
  {
    key: 'US_Air_Force',
    countries: ['us', 'united states'],
    operators: ['united states air force', 'us air force', 'usaf'],
  },
  {
    key: 'US_Navy',
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
    countries: ['ch', 'switzerland'],
  },
  {
    key: 'Roundel_of_the_United_Kingdom',
    countries: ['gb', 'great britain'],
  },
  {
    key: 'Coat_of_Arms_of_Ukraine',
    countries: ['ua', 'ukraine'],
  },
  {
    key: 'Armee_de_lAir',
    countries: ['fr', 'france'],
  },
];
