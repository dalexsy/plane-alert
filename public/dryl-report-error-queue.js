/**
 * HTTP queue helpers for dryl client error reporter.
 * Always try health.dryl.io when same-origin is 502 (deploy restart / app down).
 */
(function () {
  "use strict";

  var MAX_STORAGE_WAITS = 40;

  function start(attempt) {
    var storage = window.__DRYL_ERROR_QUEUE_STORAGE__;
    if (!storage) {
      if (attempt < MAX_STORAGE_WAITS) {
        setTimeout(function () {
          start(attempt + 1);
        }, attempt < 4 ? 0 : 25);
      }
      return;
    }
    bindQueue(storage);
  }

  function bindQueue(storage) {
  var BASE_FLUSH_MS = 400;
  var MAX_FLUSH_MS = 30_000;
  var HEALTH_ERRORS = "https://health.dryl.io/api/client-errors";
  var flushing = false;

  function defaultHttpEndpoints() {
    var list = ["/api/client-errors"];
    var host = typeof location !== "undefined" ? location.hostname || "" : "";
    if (host === "localhost" || host === "127.0.0.1") {
      list.push("http://localhost:3905/api/client-errors");
    } else if (host && host !== "health.dryl.io") {
      // Origin 502 cannot reach Directory via same-host /api/client-errors.
      list.push(HEALTH_ERRORS);
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

  function isSameOrigin(endpoint) {
    return (
      typeof location !== "undefined" &&
      (endpoint.startsWith("/") || endpoint.indexOf(location.origin) === 0)
    );
  }

  /** Fire-and-forget post: walk endpoints until one accepts (502 must fall through). */
  function postHttp(entry, allowQueue, endpoints) {
    var body = JSON.stringify(entry);
    var ep = 0;
    (function tryEndpoint() {
      if (ep >= endpoints.length) {
        if (allowQueue) storage.enqueueEntry(entry);
        return;
      }
      var endpoint = endpoints[ep++];
      var cross = !isSameOrigin(endpoint);
      // text/plain avoids CORS preflight on health.dryl.io fallthrough; servers
      // that only accept application/json still get a JSON body string.
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": cross ? "text/plain;charset=UTF-8" : "application/json",
        },
        body: body,
        credentials: cross ? "omit" : "same-origin",
        keepalive: true,
      })
        .then(function (res) {
          if (res.ok || res.status === 204) {
            storage.bumpStat("delivered");
            flushQueue(endpoints);
            return;
          }
          storage.bumpStat("retryableHttp");
          tryEndpoint();
        })
        .catch(function () {
          storage.bumpStat("retryableNet");
          tryEndpoint();
        });
    })();
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
      var cross = !isSameOrigin(endpoint);
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": cross ? "text/plain;charset=UTF-8" : "application/json",
        },
        body: body,
        credentials: cross ? "omit" : "same-origin",
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
  }

  start(0);
})();
