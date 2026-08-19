import { timingSafeEqual } from 'crypto';

export const ROW_SESSION_NOTIFY_SECRET_ENV = 'ROW_SESSION_NOTIFY_SECRET';

function headerValue(
  headers: Record<string, unknown> | undefined,
  name: string,
): string {
  if (!headers) {
    return '';
  }
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) {
    return String(raw[0] ?? '').trim();
  }
  return String(raw ?? '').trim();
}

export function rowSessionNotifySecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return String(env[ROW_SESSION_NOTIFY_SECRET_ENV] ?? '').trim();
}

export function readRowSessionNotifyToken(req: {
  headers?: Record<string, unknown>;
}): string {
  const authorization = headerValue(req.headers, 'authorization');
  const bearer = authorization.match(/^Bearer\s+(.+)$/i);
  if (bearer?.[1]) {
    return bearer[1].trim();
  }
  return headerValue(req.headers, 'x-row-notify-secret');
}

export function secretsMatch(received: string, expected: string): boolean {
  if (!expected || !received) {
    return false;
  }
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    timingSafeEqual(right, right);
    return false;
  }
  return timingSafeEqual(left, right);
}

/** Fail closed when the secret is missing or the caller token does not match. */
export function isRowSessionNotifyAuthorized(
  req: { headers?: Record<string, unknown> },
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return secretsMatch(readRowSessionNotifyToken(req), rowSessionNotifySecret(env));
}
