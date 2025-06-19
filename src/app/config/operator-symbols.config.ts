export interface OperatorSymbolConfig {
  key: string; // filename (without .svg)
  countries: string[]; // ISO2 codes
  operators?: string[]; // operator names for specific matching
}

// Centralized operator symbol configuration
export const OPERATOR_SYMBOLS: OperatorSymbolConfig[] = [
  {
    key: 'de_air_force',
    countries: ['de'],
  },
  {
    key: 'us_air_force',
    countries: ['us'],
    operators: ['united states air force', 'us air force', 'usaf'],
  },
  {
    key: 'us_navy',
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
    key: 'ch_air_force',
    countries: ['ch'],
  },
  {
    key: 'gb_air_force',
    countries: ['gb'],
  },
  {
    key: 'ua_air_force',
    countries: ['ua'],
  },
  {
    key: 'fr_air_force',
    countries: ['fr'],
  },
  {
    key: 'de_police',
    operators: ['Bundespolizei'],
    countries: ['de'],
  },
  {
    key: 'nato',
    countries: [],
    operators: ['NATO'],
  },
  {
    key: 'pl_air_force',
    countries: ['pl'],
  },
];
