import { getPlanesVapidPublicKey } from './planes-vapid';

export function isWebPushConfigured(): boolean {
  return Boolean(getPlanesVapidPublicKey());
}

/** Prod sends when VAPID is configured; staging stays muted unless explicitly armed. */
export function isWebPushSendEnabled(): boolean {
  if (!isWebPushConfigured()) return false;
  if (process.env.PLANES_API_WEB_PUSH_ENABLED === '0') return false;
  if (process.env.DRYL_ENV === 'staging') {
    return process.env.PLANES_API_WEB_PUSH_ENABLED === '1';
  }
  return true;
}
