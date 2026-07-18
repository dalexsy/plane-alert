/** Persist ICAOs across SPA reloads (noon refresh) so cold-start scans
 * do not treat every plane already in the air as brand-new for MP3 alerts.
 */

const SEEN_ICAOS_KEY = 'plane-alert:seen-icaos';
const MAX_SEEN = 400;

export function loadSeenIcaosFromSession(): Set<string> {
  if (typeof sessionStorage === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(SEEN_ICAOS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((x): x is string => typeof x === 'string' && x.length > 0),
    );
  } catch {
    return new Set();
  }
}

export function saveSeenIcaosToSession(icaos: Iterable<string>): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const list = [...new Set(icaos)].slice(0, MAX_SEEN);
    sessionStorage.setItem(SEEN_ICAOS_KEY, JSON.stringify(list));
  } catch {
    /* private mode / quota */
  }
}

/** True when this navigation came from NoonRefreshService (`?_refresh=`). */
export function isNoonRefreshNavigation(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URL(window.location.href).searchParams.has('_refresh');
  } catch {
    return false;
  }
}
