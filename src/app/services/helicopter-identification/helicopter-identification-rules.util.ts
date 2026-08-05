export function isHelicopterByOperator(operator: string): boolean {
  if (!operator || typeof operator !== 'string') return false;
  const operatorLower = operator.toLowerCase().trim();
  if (!operatorLower) return false;
  const helicopterOperators = [
    'bpo',
    'bpoli',
    'polizei',
    'police',
    'coast guard',
    'coastguard',
    'rescue',
    'sar',
    'air ambulance',
    'medevac',
    'ems',
  ];
  return helicopterOperators.some((pattern) => operatorLower.includes(pattern));
}

/** Callsigns that are almost always rotorcraft (no ADS-B category required). */
export function isHelicopterByCallsign(callsign: string): boolean {
  if (!callsign || typeof callsign !== 'string') return false;
  const normalized = callsign.trim().toUpperCase();
  if (!normalized) return false;
  const patterns = [
    /^(JOKER|TIGER|VIPER|COBRA|APACHE)\d+$/,
    /^(RESCUE|RESQ|MEDIC|LIFEGUARD|HEMS|HELIMED)\d*$/,
    /^(POLICE|POLIZEI|POLAIR|POLIS)\d*$/,
    /^(CHX|ADAC|DRF|HTM)\d+$/,
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

/** ICAO type designators that map to rotorcraft (ADS-B `t` / DB icaotype). */
export function isHelicopterByTypeDesignator(icaoType: string): boolean {
  if (!icaoType || typeof icaoType !== 'string') return false;
  const normalized = icaoType.trim().toUpperCase();
  if (!normalized) return false;
  if (/^(EC|AS|BK)(\d{2}|\d{3})$/.test(normalized)) return true;
  if (/^(H1[2-7]\d|UH\d{2}|AH\d{2}|CH\d{2}|NH\d{2}|TIGR|S76|S92|R22|R44|R66)$/.test(normalized)) {
    return true;
  }
  const known = new Set([
    'A109', 'A119', 'A139', 'A149', 'A169', 'A189', 'B06', 'B206', 'B212', 'B407',
    'B412', 'B429', 'EC35', 'EC45', 'EC55', 'H145', 'H135', 'H125', 'H160', 'H175',
  ]);
  return known.has(normalized);
}

export function isHelicopterByModel(model: string): boolean {
  if (!model || typeof model !== 'string') return false;
  const modelLower = model.toLowerCase().trim();
  if (!modelLower) return false;
  // Type codes with optional hyphen/space (AS-332, EC 145, H-145)
  if (/\b(as|ec|bk|h|uh|ah|ch|nh|bo|md|aw|sa|mi)[-\s]?\d{2,3}\b/.test(modelLower)) {
    return true;
  }
  const helicopterPatterns = [
    'copter',
    'helicopter',
    'heli',
    'chopper',
    'super puma',
    'dauphin',
    'fennec',
    'tiger',
    'nh90',
    'r22',
    'r44',
    'r66',
    'bell 206',
    'bell 407',
    'bell 412',
    'bell 429',
    'bell 430',
    'as350',
    'as355',
    'as365',
    'ec120',
    'ec130',
    'ec135',
    'ec145',
    'ec155',
    'ec175',
    'ec225',
    'ec725',
    'h125',
    'h130',
    'h135',
    'h145',
    'h155',
    'h160',
    'h175',
    'h215',
    'h225',
    'uh-1',
    'uh-60',
    'ah-64',
    'ch-47',
    'ch-53',
    'mi-8',
    'mi-17',
    'mi-24',
    'mi-26',
    'ka-32',
    's-76',
    's-92',
    'aw109',
    'aw139',
    'aw149',
    'aw169',
    'aw189',
    'md500',
    'md520',
    'md530',
    'md600',
    'md900',
    'md902',
    'black hawk',
    'Chinook',
    'JetRanger',
  ];
  return helicopterPatterns.some((pattern) => modelLower.includes(pattern));
}
