export interface OperatorSymbolConfig {
  key: string; // filename (without .svg)
  svgFileName: string; // actual SVG filename
  countries: string[]; // ISO2 codes
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
];
