/** Pick one kiosk MP3 — same priority as SPA playAlertsForNewPlanes. */

export type KioskAlertVariant = 'hercules' | 'a400' | 'default';

export function kioskAlertVariantFromModel(
  model?: string | null,
): KioskAlertVariant {
  const m = (model || '').toLowerCase();
  if (m.includes('hercules')) return 'hercules';
  if (/a\s*-?\s*400/.test(m)) return 'a400';
  return 'default';
}

export function kioskAlertFileName(variant: KioskAlertVariant): string {
  if (variant === 'hercules') return 'hercules.mp3';
  if (variant === 'a400') return 'iago.mp3';
  return 'precious_little_life_forms.mp3';
}
