export const PLANES_PUSH_SW_URL = '/sw.js';

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64.replace(/-/g, '+').replace(/_/g, '/') + padding);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

const INSTALLATION_STORAGE_KEY = 'plane-alert-installation-id';

export function getOrCreateInstallationId(): string {
  const existing = localStorage.getItem(INSTALLATION_STORAGE_KEY)?.trim();
  if (existing && existing.length >= 8) {
    return existing;
  }
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `pa-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  localStorage.setItem(INSTALLATION_STORAGE_KEY, id);
  return id;
}

export const PWA_ALERTS_ENABLED_KEY = 'plane-alert-pwa-alerts-enabled';
