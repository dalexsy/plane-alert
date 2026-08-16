import { hostname } from 'os';

function flagOff(value: string | undefined): boolean {
  const flag = String(value ?? '').trim().toLowerCase();
  return flag === '0' || flag === 'false' || flag === 'off' || flag === 'no';
}

/**
 * Staging copies prod planes-api (including the live Pushover token).
 * Hostname `dryl-staging` always wins — a rsynced `.env` must not re-arm phones.
 */
export function isPushoverSendEnabled(
  env: NodeJS.ProcessEnv = process.env,
  hostName = hostname(),
): boolean {
  if (flagOff(env.PLANES_API_PUSHOVER_ENABLED)) {
    return false;
  }
  if (String(env.DRYL_ENV ?? '').trim().toLowerCase() === 'staging') {
    return false;
  }
  if (/staging/i.test(hostName)) {
    return false;
  }
  return true;
}
