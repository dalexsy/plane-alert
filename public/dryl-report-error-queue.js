/**
 * HTTP queue helpers for dryl client error reporter.
 */
(function () {
  "use strict";

  var QUEUE_KEY = "dryl_client_error_queue_v1";
  var QUEUE_STATS_KEY = "dryl_client_error_queue_stats_v1";
  var QUEUE_MAX = 48;
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
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-QUEUE_MAX)));
    } catch {
      // ignore
    }
  }

  function loadStats() {
    try {
      var raw = localStorage.getItem(QUEUE_STATS_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(QUEUE_STATS_KEY, JSON.stringify(stats));
    } catch {
      // ignore
    }
  }

  function bumpStat(key) {
    var stats = loadStats();
    stats[key] = (stats[key] || 0) + 1;
    stats.lastAt = new Date().toISOString();
    saveStats(stats);
  }

  function wrapQueued(entry) {
    if (entry && typeof entry === "object" && entry.payload) return entry;
    return { payload: entry, attempts: 0, nextAt: 0 };
  }

  function enqueueEntry(entry) {
    var queue = loadQueue().map(wrapQueued);
    queue.push({ payload: entry, attempts: 0, nextAt: Date.now() + BASE_FLUSH_MS });
    saveQueue(queue);
    bumpStat("enqueued");
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
              bumpStat("delivered");
              flushQueue(endpoints);
            } else if (allowQueue) {
              bumpStat("retryableHttp");
              enqueueEntry(entry);
            }
          })
          .catch(function () {
            if (allowQueue) {
              bumpStat("retryableNet");
              enqueueEntry(entry);
            }
          });
        return;
      } catch {
        // try next endpoint
      }
    }
    if (allowQueue) enqueueEntry(entry);
  }

  function flushQueue(endpoints) {
    if (flushing) return;
    var queue = loadQueue().map(wrapQueued);
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
    saveQueue(rest);
    flushing = true;
    var body = JSON.stringify(next.payload);
    var i = 0;
    (function tryEndpoint() {
      if (i >= endpoints.length) {
        next.attempts = (next.attempts || 0) + 1;
        next.nextAt = Date.now() + backoffMs(next.attempts);
        var requeue = loadQueue().map(wrapQueued);
        requeue.push(next);
        saveQueue(requeue);
        bumpStat("retryableHttp");
        flushing = false;
        setTimeout(function () { flushQueue(endpoints); }, backoffMs(next.attempts));
        return;
      }
      var endpoint = endpoints[i++];
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
            bumpStat("delivered");
            flushing = false;
            setTimeout(function () { flushQueue(endpoints); }, BASE_FLUSH_MS);
            return;
          }
          tryEndpoint();
        })
        .catch(function () {
          bumpStat("retryableNet");
          tryEndpoint();
        });
    })();
  }

  window.__DRYL_ERROR_QUEUE__ = {
    resolveEndpoints: resolveEndpoints,
    postHttp: postHttp,
    flushQueue: flushQueue,
    loadStats: loadStats,
  };
})();
