/** Shared dryl client error reporter — POST /api/client-errors, queue, dedupe. */
(function () {
  "use strict";

  var APP =
    (typeof window !== "undefined" && window.__DRYL_APP_ID__) || "unknown";
  var EXTRA_ENDPOINTS = Array.isArray(window.__DRYL_ERROR_ENDPOINTS__)
    ? window.__DRYL_ERROR_ENDPOINTS__
    : [];
  var DEDUPE_MS = 5 * 60 * 1000;
  var BURST_MAX = 40;
  var BURST_WINDOW_MS = 10 * 60 * 1000;
  var QUEUE_KEY = "dryl_client_error_queue_v1";
  var QUEUE_MAX = 48;
  var recentByKey = Object.create(null);
  var burst = { count: 0, windowStart: 0 };

  function defaultHttpEndpoints() {
    var list = ["/api/client-errors"];
    var host = hostName();
    if (host === "localhost" || host === "127.0.0.1") {
      list.push("http://localhost:3905/api/client-errors");
    }
    return list;
  }

  var ENDPOINTS = []
    .concat(
      typeof window.__DRYL_ERROR_ENDPOINT__ === "string"
        ? [window.__DRYL_ERROR_ENDPOINT__]
        : [],
      EXTRA_ENDPOINTS,
      defaultHttpEndpoints(),
    )
    .filter(Boolean);

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

  function hostName() {
    if (typeof location === "undefined") return "";
    return location.hostname || "";
  }

  function isFirestoreQuotaMessage(message) {
    var msg = String(message || "");
    return (
      /resource-exhausted/i.test(msg) ||
      /quota exceeded/i.test(msg) ||
      /firestore quota exceeded/i.test(msg)
    );
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

  function fingerprint(level, message) {
    return (
      APP +
      "|" +
      (level || "error") +
      "|" +
      String(message || "").slice(0, 240)
    );
  }

  function isExplicitReport(context) {
    if (!context || typeof context.source !== "string") return false;
    return context.source.indexOf("app-report") === 0;
  }

  function isNoiseError(message, stack) {
    var msg = String(message || "").trim();
    var st = String(stack || "");
    if (isFirestoreQuotaMessage(msg)) return false;
    if (/^failed to fetch\.?$/i.test(msg)) return true;
    if (/networkerror|load failed|network request failed/i.test(msg)) return true;
    if (/failed to fetch/i.test(msg) && /chrome-extension:\/\//i.test(st)) {
      return true;
    }
    if (/dryl-report-error\.js/i.test(st)) return true;
    if (/^NaN:\s*NaN$/i.test(msg)) return true;
    if (/FIREBASE_APPS|firebase.*initialize/i.test(msg + " " + st)) return true;
    return false;
  }

  function shouldReport(level, message, context) {
    if (isExplicitReport(context || {})) return true;
    var now = Date.now();
    var key = fingerprint(level, message);
    var last = recentByKey[key];
    if (last && now - last < DEDUPE_MS) return false;

    if (!burst.windowStart || now - burst.windowStart > BURST_WINDOW_MS) {
      burst.windowStart = now;
      burst.count = 0;
    }
    if (burst.count >= BURST_MAX) return false;

    recentByKey[key] = now;
    burst.count += 1;
    return true;
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

  function loadQueue() {
    try {
      var raw = localStorage.getItem(QUEUE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveQueue(queue) {
    try {
      localStorage.setItem(
        QUEUE_KEY,
        JSON.stringify(queue.slice(-QUEUE_MAX)),
      );
    } catch {
      // ignore
    }
  }

  function enqueueEntry(entry) {
    var queue = loadQueue();
    queue.push(entry);
    saveQueue(queue);
  }

  function postHttp(entry, allowQueue) {
    var body = JSON.stringify(entry);
    for (var i = 0; i < ENDPOINTS.length; i += 1) {
      var endpoint = ENDPOINTS[i];
      var sameOrigin =
        typeof location !== "undefined" &&
        (endpoint.startsWith("/") ||
          endpoint.indexOf(location.origin) === 0);
      try {
        void fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          credentials: sameOrigin ? "same-origin" : "omit",
          keepalive: true,
        })
          .then(function (res) {
            if (res.ok || res.status === 204) {
              flushQueue();
            } else if (allowQueue) {
              enqueueEntry(entry);
            }
          })
          .catch(function () {
            if (allowQueue) enqueueEntry(entry);
          });
        return;
      } catch {
        // try next endpoint
      }
    }
    if (allowQueue) enqueueEntry(entry);
  }

  function flushQueue() {
    var queue = loadQueue();
    if (!queue.length) return;
    var next = queue[0];
    var rest = queue.slice(1);
    saveQueue(rest);
    postHttp(next, false);
    if (rest.length) {
      setTimeout(flushQueue, 400);
    }
  }

  function report(value, context, level) {
    var norm = normalizeMessage(value);
    var resolvedLevel = level || "error";
    var ctx = context || {};
    if (isFirestoreQuotaMessage(norm.message)) {
      ctx.source = ctx.source || "app-report-firestore-quota";
      resolvedLevel = resolvedLevel === "info" ? "warn" : resolvedLevel;
    }
    var explicit = isExplicitReport(ctx);
    if (!explicit && isNoiseError(norm.message, norm.stack)) return;
    if (!shouldReport(resolvedLevel, norm.message, ctx)) return;

    var entry = buildEntry(resolvedLevel, norm.message, norm.stack, ctx);
    postHttp(entry, true);
  }

  function reportHttpFailure(url, status, method, context) {
    if (!status || status < 400) return;
    var path = String(url || "");
    if (/\/api\/client-errors\b/i.test(path) && /POST/i.test(method || "")) return;
    var ctx = context || {};
    ctx.source = ctx.source || "http-failure";
    ctx.status = status;
    ctx.method = method || "GET";
    report("HTTP " + status + " " + path, ctx, status >= 500 ? "error" : "warn");
  }

  window.drylReportError = report;
  window.drylReportHttpFailure = reportHttpFailure;

  window.addEventListener("error", function (event) {
    report(event.error || event.message, { source: "window.onerror" }, "error");
  });

  window.addEventListener("unhandledrejection", function (event) {
    var norm = normalizeMessage(event.reason);
    if (isNoiseError(norm.message, norm.stack)) {
      event.preventDefault();
      return;
    }
    report(event.reason, { source: "unhandledrejection" }, "error");
  });

  setTimeout(flushQueue, 800);
})();