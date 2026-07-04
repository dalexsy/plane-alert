/**
 * Local storage helpers for dryl client error queue.
 */
(function () {
  "use strict";

  var QUEUE_KEY = "dryl_client_error_queue_v1";
  var QUEUE_STATS_KEY = "dryl_client_error_queue_stats_v1";
  var QUEUE_MAX = 48;

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
    queue.push({ payload: entry, attempts: 0, nextAt: Date.now() + 400 });
    saveQueue(queue);
    bumpStat("enqueued");
  }

  window.__DRYL_ERROR_QUEUE_STORAGE__ = {
    loadQueue: loadQueue,
    saveQueue: saveQueue,
    loadStats: loadStats,
    bumpStat: bumpStat,
    wrapQueued: wrapQueued,
    enqueueEntry: enqueueEntry,
  };
})();