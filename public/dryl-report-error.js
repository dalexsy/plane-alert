/** Shared dryl client error reporter — POST /api/client-errors, queue, dedupe. */
(function () {
  "use strict";

  var booted = false;
  var MAX_BOOT_ATTEMPTS = 40;

  function boot(attempt) {
    if (booted || window.drylReportError) return;
    var filter = window.__DRYL_ERROR_FILTER__;
    var payload = window.__DRYL_ERROR_PAYLOAD__;
    var queue = window.__DRYL_ERROR_QUEUE__;
    // Main before deps (mis-ordered index.html) — poll until sibling sync tags run.
    if (!filter || !payload || !queue) {
      if (attempt < MAX_BOOT_ATTEMPTS) {
        setTimeout(function () {
          boot(attempt + 1);
        }, attempt < 4 ? 0 : 25);
      }
      return;
    }
    booted = true;

    function report(value, context, level) {
      var norm = payload.normalizeMessage(value);
      var resolvedLevel = level || "error";
      var ctx = context || {};
      if (
        !filter.isExplicitReport(ctx) &&
        filter.isNoiseError(norm.message, norm.stack)
      ) {
        return;
      }
      if (!filter.shouldReport(resolvedLevel, norm.message, ctx)) return;

      var entry = payload.buildEntry(
        resolvedLevel,
        norm.message,
        norm.stack,
        ctx,
      );
      queue.postHttp(entry, true, queue.resolveEndpoints());
    }

    function reportHttpFailure(url, status, method, context) {
      if (!status || status < 400) return;
      var path = String(url || "");
      if (/\/api\/client-errors\b/i.test(path) && /POST/i.test(method || "")) {
        return;
      }
      // CF tunnel/origin blips (502/530) — fallthrough to status shares the same
      // tunnel and only floods the console with CORS; queue on next paint instead.
      if (
        status === 502 ||
        status === 503 ||
        status === 520 ||
        status === 521 ||
        status === 522 ||
        status === 523 ||
        status === 524 ||
        status === 525 ||
        status === 530
      ) {
        return;
      }
      var ctx = context || {};
      ctx.source = ctx.source || "http-failure";
      ctx.status = status;
      ctx.method = method || "GET";
      report(
        "HTTP " + status + " " + path,
        ctx,
        status >= 500 ? "error" : "warn",
      );
    }

    window.drylReportError = report;
    window.drylReportHttpFailure = reportHttpFailure;

    window.addEventListener("error", function (event) {
      report(event.error || event.message, { source: "window.onerror" }, "error");
    });

    window.addEventListener("unhandledrejection", function (event) {
      var norm = payload.normalizeMessage(event.reason);
      if (filter.isNoiseError(norm.message, norm.stack)) {
        event.preventDefault();
        return;
      }
      report(event.reason, { source: "unhandledrejection" }, "error");
    });

    setTimeout(function () {
      queue.flushQueue(queue.resolveEndpoints());
    }, 800);
  }

  boot(0);
})();
/* dryl-bug-report-boot:2 */
(function () {
  try {
    var host = (location.hostname || "").toLowerCase();
    if (host === "balcony.dryl.io" || host === "planes.dryl.io") return;
    function isPrivateLan(h) {
      var parts = h.split(".");
      if (parts.length !== 4) return false;
      var a = +parts[0], b = +parts[1], c = +parts[2], d = +parts[3];
      if (!(a >= 0 && a <= 255 && b >= 0 && b <= 255 && c >= 0 && c <= 255 && d >= 0 && d <= 255)) {
        return false;
      }
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      return false;
    }
    var isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      isPrivateLan(host);
    var isDryl = host === "dryl.io" || host.slice(-8) === ".dryl.io";
    if (!isLocal && !isDryl) return;
    if (document.querySelector('script[src*="dryl-bug-report.js"]')) return;
    var script = document.createElement("script");
    script.src = "/dryl-bug-report.js";
    script.async = true;
    (document.head || document.documentElement).appendChild(script);
  } catch (_err) {
    /* ignore */
  }
})();

