/**
 * Dedupe and noise filtering for dryl client error reporter.
 */
(function () {
  "use strict";

  var APP =
    (typeof window !== "undefined" && window.__DRYL_APP_ID__) || "unknown";
  var DEDUPE_MS = 5 * 60 * 1000;
  var BURST_MAX = 40;
  var BURST_WINDOW_MS = 10 * 60 * 1000;
  var recentByKey = Object.create(null);
  var burst = { count: 0, windowStart: 0 };

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
    if (/^failed to fetch\.?$/i.test(msg)) return true;
    if (/networkerror|load failed|network request failed/i.test(msg)) return true;
    if (/failed to fetch/i.test(msg) && /chrome-extension:\/\//i.test(st)) {
      return true;
    }
    if (/dryl-report-error\.js/i.test(st)) return true;
    if (/^NaN:\s*NaN$/i.test(msg)) return true;
    // CF tunnel blips — browser already shows net::ERR; inbox storm is useless.
    if (/^HTTP (502|503|520|521|522|523|524|525|530)\b/i.test(msg)) return true;
    return false;
  }

  function shouldReport(level, message, context) {
    // Defense if an older watch-network-report.js still files HLS segment blips.
    if (/^watch resource failed:.*\/api\/live\/hls\//i.test(String(message || ""))) {
      return false;
    }
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

  window.__DRYL_ERROR_FILTER__ = {
    isExplicitReport: isExplicitReport,
    isNoiseError: isNoiseError,
    shouldReport: shouldReport,
  };
})();