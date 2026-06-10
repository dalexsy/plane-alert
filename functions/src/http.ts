export function applyCors(res: any, allowedMethods: string): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', allowedMethods);
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

export function handleOptionsPreflight(req: any, res: any): boolean {
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }

  return false;
}