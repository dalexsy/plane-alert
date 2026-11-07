import { getPlanesVapidPublicKey } from './planes-vapid';

export function isWebPushConfigured(): boolean {
  return Boolean(getPlanesVapidPublicKey());
}

/** Prod sends when VAPID is configured; staging stays muted unless explicitly armed. */
export function isWebPushSendEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!isWebPushConfigured()) return false;
  if (env.PLANES_API_WEB_PUSH_ENABLED === '0') return false;
  if (env.DRYL_ENV === 'staging') {
    return env.PLANES_API_WEB_PUSH_ENABLED === '1';
  }
  return true;
}
