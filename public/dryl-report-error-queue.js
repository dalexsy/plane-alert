/**
 * HTTP queue helpers for dryl client error reporter.
 */
(function () {
  "use strict";

  var storage = window.__DRYL_ERROR_QUEUE_STORAGE__;
  if (!storage) return;

  var BASE_FLUSH_MS = 400;
  var MAX_FLUSH_MS = 30_000;
  var flushing = false;

  function defaultHttpEndpoints() {
    var list = ["/api/client-errors"];
    var host = typeof location !== "undefined" ? location.hostname || "" : "";
    if (host === "localhost" || host === "127.0.0.1") {
      list.push("http://localhost:3905/api/client-errors");
    }
    return list;
  }

  function resolveEndpoints() {
    var extra = Array.isArray(window.__DRYL_ERROR_ENDPOINTS__)
      ? window.__DRYL_ERROR_ENDPOINTS__
      : [];
    return []
      .concat(
        typeof window.__DRYL_ERROR_ENDPOINT__ === "string"
          ? [window.__DRYL_ERROR_ENDPOINT__]
          : [],
        extra,
        defaultHttpEndpoints(),
      )
      .filter(Boolean);
  }

  function backoffMs(attempts) {
    var ms = BASE_FLUSH_MS * Math.pow(2, Math.min(attempts, 8));
    return Math.min(ms, MAX_FLUSH_MS);
  }

  function postHttp(entry, allowQueue, endpoints) {
    var body = JSON.stringify(entry);
    for (var i = 0; i < endpoints.length; i += 1) {
      var endpoint = endpoints[i];
      var sameOrigin =
        typeof location !== "undefined" &&
        (endpoint.startsWith("/") || endpoint.indexOf(location.origin) === 0);
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
              storage.bumpStat("delivered");
              flushQueue(endpoints);
            } else if (allowQueue) {
              storage.bumpStat("retryableHttp");
              storage.enqueueEntry(entry);
            }
          })
          .catch(function () {
            if (allowQueue) {
              storage.bumpStat("retryableNet");
              storage.enqueueEntry(entry);
            }
          });
        return;
      } catch {
        // try next endpoint
      }
    }
    if (allowQueue) storage.enqueueEntry(entry);
  }

  function flushQueue(endpoints) {
    if (flushing) return;
    var queue = storage.loadQueue().map(storage.wrapQueued);
    if (!queue.length) return;
    var now = Date.now();
    var readyIdx = -1;
    for (var i = 0; i < queue.length; i += 1) {
      if ((queue[i].nextAt || 0) <= now) {
        readyIdx = i;
        break;
      }
    }
    if (readyIdx < 0) {
      var wait = Math.max(50, (queue[0].nextAt || now) - now);
      setTimeout(function () { flushQueue(endpoints); }, wait);
      return;
    }
    var next = queue[readyIdx];
    var rest = queue.slice(0, readyIdx).concat(queue.slice(readyIdx + 1));
    storage.saveQueue(rest);
    flushing = true;
    var body = JSON.stringify(next.payload);
    var ep = 0;
    (function tryEndpoint() {
      if (ep >= endpoints.length) {
        next.attempts = (next.attempts || 0) + 1;
        next.nextAt = Date.now() + backoffMs(next.attempts);
        var requeue = storage.loadQueue().map(storage.wrapQueued);
        requeue.push(next);
        storage.saveQueue(requeue);
        storage.bumpStat("retryableHttp");
        flushing = false;
        setTimeout(function () { flushQueue(endpoints); }, backoffMs(next.attempts));
        return;
      }
      var endpoint = endpoints[ep++];
      var sameOrigin =
        typeof location !== "undefined" &&
        (endpoint.startsWith("/") || endpoint.indexOf(location.origin) === 0);
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        credentials: sameOrigin ? "same-origin" : "omit",
        keepalive: true,
      })
        .then(function (res) {
          if (res.ok || res.status === 204) {
            storage.bumpStat("delivered");
            flushing = false;
            setTimeout(function () { flushQueue(endpoints); }, BASE_FLUSH_MS);
            return;
          }
          tryEndpoint();
        })
        .catch(function () {
          storage.bumpStat("retryableNet");
          tryEndpoint();
        });
    })();
  }

  window.__DRYL_ERROR_QUEUE__ = {
    resolveEndpoints: resolveEndpoints,
    postHttp: postHttp,
    flushQueue: flushQueue,
    loadStats: storage.loadStats,
  };
})();