/** Public Overpass mirrors — primary often returns 504 under load. */
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RETRIES = 2;

/**
 * POST an Overpass QL query with client timeout, retries, and mirror failover.
 * Without AbortSignal, a gateway 504 can hang the browser for minutes.
 */
export async function fetchOverpassJson(
  query: string,
  opts?: { timeoutMs?: number; retries?: number },
): Promise<{ elements?: unknown[] }> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts?.retries ?? DEFAULT_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const url = OVERPASS_MIRRORS[attempt % OVERPASS_MIRRORS.length];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Overpass ${response.status} ${response.statusText}`);
      }
      return (await response.json()) as { elements?: unknown[] };
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Overpass request failed');
}
