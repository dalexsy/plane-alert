/** Shared dryl client error reporter — POST /api/client-errors, queue, dedupe. */
(function () {
  "use strict";

  var filter = window.__DRYL_ERROR_FILTER__;
  var payload = window.__DRYL_ERROR_PAYLOAD__;
  var queue = window.__DRYL_ERROR_QUEUE__;
  if (!filter || !payload || !queue) return;

  function report(value, context, level) {
    var norm = payload.normalizeMessage(value);
    var resolvedLevel = level || "error";
    var ctx = context || {};
    if (filter.isFirestoreQuotaMessage(norm.message)) {
      ctx.source = ctx.source || "app-report-firestore-quota";
      resolvedLevel = resolvedLevel === "info" ? "warn" : resolvedLevel;
    }
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
})();