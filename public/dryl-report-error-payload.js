/**
 * Payload builders for dryl client error reporter.
 */
(function () {
  "use strict";

  var APP =
    (typeof window !== "undefined" && window.__DRYL_APP_ID__) || "unknown";
  var SESSION_KEY = "dryl_report_session_v1";

  function reportSessionId() {
    try {
      var existing = sessionStorage.getItem(SESSION_KEY);
      if (existing && existing.trim()) return existing.trim();
      var id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "sess-" + Date.now();
      sessionStorage.setItem(SESSION_KEY, id);
      return id;
    } catch {
      return "";
    }
  }

  function hostName() {
    if (typeof location === "undefined") return "";
    return location.hostname || "";
  }

  function deviceInfo() {
    if (typeof navigator === "undefined") return {};
    return {
      sessionId: reportSessionId(),
      userAgent: navigator.userAgent || "",
      language: navigator.language || "",
      viewport:
        typeof window !== "undefined"
          ? window.innerWidth + "x" + window.innerHeight
          : "",
      screen:
        typeof screen !== "undefined"
          ? screen.width + "x" + screen.height
          : "",
      timezone:
        typeof Intl !== "undefined" && Intl.DateTimeFormat
          ? Intl.DateTimeFormat().resolvedOptions().timeZone || ""
          : "",
      touch:
        typeof navigator.maxTouchPoints === "number"
          ? navigator.maxTouchPoints > 0
          : false,
      pageHost: hostName(),
      pageUrl: typeof location !== "undefined" ? location.href || "" : "",
    };
  }

  function normalizeMessage(value) {
    if (value instanceof Error) {
      return { message: value.message || String(value), stack: value.stack };
    }
    if (typeof value === "string") return { message: value };
    try {
      return { message: JSON.stringify(value) };
    } catch {
      return { message: String(value) };
    }
  }

  function buildEntry(level, message, stack, context) {
    var appId = APP;
    if (context && typeof context.app === "string" && context.app.trim()) {
      appId = context.app.trim();
    }
    var ctxDevice =
      context && context.device && typeof context.device === "object"
        ? context.device
        : null;
    return {
      app: appId,
      level: level || "error",
      message: message,
      stack: stack,
      context: context,
      url: typeof location !== "undefined" ? location.href : undefined,
      host: hostName(),
      device: ctxDevice || deviceInfo(),
      at: new Date().toISOString(),
    };
  }

  window.__DRYL_ERROR_PAYLOAD__ = {
    normalizeMessage: normalizeMessage,
    buildEntry: buildEntry,
  };
})();