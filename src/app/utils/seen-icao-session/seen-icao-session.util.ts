/** Persist ICAOs across SPA reloads AND Chromium session wipes.
 * Daytime kiosk restart deletes Session Storage; sessionStorage alone let every
 * in-air plane look brand-new and fire MP3s with nothing newly interesting.
 */

const SEEN_ICAOS_KEY = 'plane-alert:seen-icaos';
const MAX_SEEN = 400;

function readStore(): Storage | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

export function loadSeenIcaosFromSession(): Set<string> {
  const store = readStore();
  if (!store) return new Set();
  try {
    // Migrate once from sessionStorage (noon-refresh era) into localStorage.
    if (typeof sessionStorage !== 'undefined') {
      const legacy = sessionStorage.getItem(SEEN_ICAOS_KEY);
      if (legacy && !store.getItem(SEEN_ICAOS_KEY)) {
        store.setItem(SEEN_ICAOS_KEY, legacy);
        sessionStorage.removeItem(SEEN_ICAOS_KEY);
      }
    }
    const raw = store.getItem(SEEN_ICAOS_KEY);
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
  const store = readStore();
  if (!store) return;
  try {
    // Union with prior seen — replacing with only currently visible ICAOs
    // made ADS-B flicker drop a mil from storage so the next poll re-alerted.
    const merged = loadSeenIcaosFromSession();
    for (const icao of icaos) {
      if (icao) merged.add(icao);
    }
    const current = [...new Set(icaos)].filter(Boolean);
    const older = [...merged].filter((icao) => !current.includes(icao));
    const list = [...older, ...current].slice(-MAX_SEEN);
    store.setItem(SEEN_ICAOS_KEY, JSON.stringify(list));
  } catch {
    /* private mode / quota */
  }
}
