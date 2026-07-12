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

export function isHelicopterByModel(model: string): boolean {
  if (!model || typeof model !== 'string') return false;
  const modelLower = model.toLowerCase().trim();
  if (!modelLower) return false;
  const helicopterPatterns = [
    'copter',
    'helicopter',
    'heli',
    'chopper',
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
