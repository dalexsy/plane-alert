const EXPECTED_EUROPEAN_COUNTRIES = {
  // Baltic States (the pattern we identified)
  LT: { name: "Lithuania", priority: 1 },
  LV: { name: "Latvia", priority: 1 },
  EE: { name: "Estonia", priority: 1 },

  // Other potential missing small European states
  MD: { name: "Moldova", priority: 2 },
  AL: { name: "Albania", priority: 2 },
  MK: { name: "North Macedonia", priority: 2 },
  ME: { name: "Montenegro", priority: 2 },
  BA: { name: "Bosnia and Herzegovina", priority: 2 },
  RS: { name: "Serbia", priority: 2 },
  BG: { name: "Bulgaria", priority: 3 },
  RO: { name: "Romania", priority: 3 },
  HR: { name: "Croatia", priority: 3 },
  SI: { name: "Slovenia", priority: 3 },
  SK: { name: "Slovakia", priority: 3 },
  CZ: { name: "Czech Republic", priority: 3 },
};
module.exports = { EXPECTED_EUROPEAN_COUNTRIES };
