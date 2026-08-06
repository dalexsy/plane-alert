/**
 * HTTP queue helpers for dryl client error reporter.
 * Fallthrough ingest from window.__DRYL_FLEET_RUNTIME__ (serviceBindings).
 */
(function () {
  "use strict";

  var MAX_STORAGE_WAITS = 40;

  function start(attempt) {
    var storage = window.__DRYL_ERROR_QUEUE_STORAGE__;
    if (!storage) {
      if (attempt < MAX_STORAGE_WAITS) {
        setTimeout(function () { start(attempt + 1); }, attempt < 4 ? 0 : 25);
      }
      return;
    }
    bindQueue(storage);
  }

  function fleetRuntime() {
    return window.__DRYL_FLEET_RUNTIME__ || {};
  }

  function ingestUrl() {
    var cfg = fleetRuntime();
    if (cfg.clientErrorIngestUrl) return cfg.clientErrorIngestUrl;
    return cfg.fleetStatusOrigin ? cfg.fleetStatusOrigin + "/api/client-errors" : "";
  }

  function ingestHostname() {
    var cfg = fleetRuntime();
    if (cfg.fleetStatusHostname) return cfg.fleetStatusHostname;
    try { return new URL(ingestUrl()).hostname; } catch (_e) { return ""; }
  }

  function bindQueue(storage) {
  var BASE_FLUSH_MS = 400;
  var MAX_FLUSH_MS = 30_000;
  var flushing = false;

  function defaultHttpEndpoints() {
    var list = ["/api/client-errors"];
    var host = typeof location !== "undefined" ? location.hostname || "" : "";
    var statusHost = ingestHostname();
    if (host === "localhost" || host === "127.0.0.1") {
      list.push("http://localhost:3905/api/client-errors");
    } else if (host && statusHost && host !== statusHost) {
      var url = ingestUrl();
      if (url) list.push(url);
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
    return Math.min(BASE_FLUSH_MS * Math.pow(2, Math.min(attempts, 8)), MAX_FLUSH_MS);
  }

  function isSameOrigin(endpoint) {
    return (
      typeof location !== "undefined" &&
      (endpoint.startsWith("/") || endpoint.indexOf(location.origin) === 0)
    );
  }

  function postOnce(endpoint, body) {
    var cross = !isSameOrigin(endpoint);
    return fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": cross ? "text/plain;charset=UTF-8" : "application/json",
      },
      body: body,
      credentials: cross ? "omit" : "same-origin",
      // no-cors: when status.* shares a flapping CF tunnel, cors mode logs
      // "No Access-Control-Allow-Origin" on every CF error page (console flood).
      mode: cross ? "no-cors" : "cors",
      keepalive: true,
    });
  }

  function responseAccepted(res) {
    if (!res) return false;
    // Opaque (no-cors) — no CORS console spam, but status is unknowable.
    // Do not count as delivered; walk to queue so a later same-origin flush can retry.
    if (res.type === "opaque") return false;
    return res.ok || res.status === 204;
  }

  /** Walk endpoints until one accepts (502 must fall through). */
  function postHttp(entry, allowQueue, endpoints) {
    var body = JSON.stringify(entry);
    var ep = 0;
    (function tryEndpoint() {
      if (ep >= endpoints.length) {
        if (allowQueue) storage.enqueueEntry(entry);
        return;
      }
      postOnce(endpoints[ep++], body)
        .then(function (res) {
          if (responseAccepted(res)) {
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
      if ((queue[i].nextAt || 0) <= now) { readyIdx = i; break; }
    }
    if (readyIdx < 0) {
      setTimeout(function () { flushQueue(endpoints); }, Math.max(50, (queue[0].nextAt || now) - now));
      return;
    }
    var next = queue[readyIdx];
    storage.saveQueue(queue.slice(0, readyIdx).concat(queue.slice(readyIdx + 1)));
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
      postOnce(endpoints[ep++], body)
        .then(function (res) {
          if (responseAccepted(res)) {
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
