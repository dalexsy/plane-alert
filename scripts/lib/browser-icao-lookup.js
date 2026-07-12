/** ICAO Country Ranges (subset for browser use - add more as needed) */
export const ICAO_RANGES = [
  { start: 0x440000, end: 0x47ffff, country: "IT", range: "440000-47FFFF" },
  { start: 0x505c00, end: 0x505fff, country: "FI", range: "505C00-505FFF" },
  { start: 0x4b0000, end: 0x4b7fff, country: "CH", range: "4B0000-4B7FFF" },
  { start: 0x400000, end: 0x43ffff, country: "GB", range: "400000-43FFFF" },
  { start: 0x380000, end: 0x3fffff, country: "FR", range: "380000-3FFFFF" },
  { start: 0x3c0000, end: 0x3fffff, country: "DE", range: "3C0000-3FFFFF" },
];

/** Registration prefixes (subset) */
export const REG_PREFIXES = {
  OH: "FI",
  HB: "CH",
  G: "GB",
  F: "FR",
  D: "DE",
  N: "US",
  VH: "AU",
  JA: "JP",
  HL: "KR",
  B: "CN",
  RA: "RU",
};

export function findIcaoCountry(icaoHex) {
  const decimal = parseInt(icaoHex, 16);
  const range = ICAO_RANGES.find((r) => decimal >= r.start && decimal <= r.end);
  return range ? { ...range, decimal } : null;
}

module.exports = {
  ICAO_RANGES,
  REG_PREFIXES,
  findIcaoCountry,
  findRegistrationCountry,
};
