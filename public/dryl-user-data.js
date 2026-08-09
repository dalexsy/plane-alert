/**
 * Account-scoped JSON blobs via dryl-auth (requires dryl_session on *.dryl.io).
 * @param {string} appKey e.g. "row"
 */
window.drylUserDataStore = function drylUserDataStore(appKey) {
  const host =
    typeof window !== "undefined" ? window.location.hostname : "";
  const base =
    host.endsWith(".dryl.io") ||
    host === "dryl.io" ||
    host === "localhost" ||
    host === "127.0.0.1"
      ? "/api/dryl"
      : "https://admin.dryl.io/api";

  async function authMe() {
    const res = await fetch(`${base}/auth/me`, {
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 401) {
      return null;
    }
    if (!res.ok) {
      throw new Error("Could not reach dryl-auth.");
    }
    const body = await res.json();
    return body?.user ?? null;
  }

  async function loadRemote() {
    const res = await fetch(`${base}/user-app-data/${encodeURIComponent(appKey)}`, {
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (res.status === 401) {
      return null;
    }
    if (!res.ok) {
      throw new Error("Could not load account data.");
    }
    const body = await res.json();
    return body.data ?? null;
  }

  async function saveRemote(data) {
    const res = await fetch(`${base}/user-app-data/${encodeURIComponent(appKey)}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    if (res.status === 401) {
      throw new Error("SIGN_IN_REQUIRED");
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Could not save account data.");
    }
  }

  return { authMe, loadRemote, saveRemote };
};