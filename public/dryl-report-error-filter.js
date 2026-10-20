/**
 * Dedupe and noise filtering for dryl client error reporter.
 */
(function drylConciergeShellHeal() {
  if (typeof window === "undefined" || typeof location === "undefined") return;
  if (location.hostname !== "concierge.dryl.io") return;

  function heal(trigger) {
    var key = "drylConciergeShellHeal";
    try {
      var last = parseInt(sessionStorage.getItem(key + ":at") || "0", 10);
      if (last && Date.now() - last < 60000) return;
      sessionStorage.setItem(key + ":at", String(Date.now()));
      var n = parseInt(sessionStorage.getItem(key) || "0", 10);
      if (n >= 3) {
        if (!sessionStorage.getItem(key + ":hard")) {
          sessionStorage.setItem(key + ":hard", "1");
          location.replace(
            location.origin + "/index.html?_=" + Date.now() + "&next=/inbox",
          );
        }
        return;
      }
      sessionStorage.setItem(key, String(n + 1));
    } catch (e) {
      return;
    }
    function go() {
      location.replace(location.origin + "/?_shell=" + Date.now());
    }
    function afterCaches() {
      if (typeof caches !== "undefined" && caches.keys) {
        caches
          .keys()
          .then(function (keys) {
            return Promise.all(
              keys.map(function (k) {
                return caches.delete(k);
              }),
            );
          })
          .catch(function () {})
          .finally(go);
      } else go();
    }
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker
        .getRegistrations()
        .then(function (regs) {
          return Promise.all(
            regs.map(function (r) {
              return r.unregister();
            }),
          );
        })
        .catch(function () {})
        .then(afterCaches);
    } else afterCaches();
  }

  var appId = window.__DRYL_APP_ID__;
  if (appId && appId !== "concierge") heal("app-id");

  window.addEventListener(
    "error",
    function (ev) {
      var t = ev.target;
      if (!t || t.tagName !== "SCRIPT") return;
      var src = t.src || t.getAttribute("src") || "";
      if (/main-[A-Z0-9]+\.js/i.test(src)) {
        try {
          location.replace(location.origin + "/shell-heal.html");
        } catch (e) {
          heal("asset");
        }
        return;
      }
      if (/styles-[A-Z0-9]+\.css/i.test(src)) {
        heal("asset");
      }
    },
    true,
  );

  function probeMain() {
    var s = document.querySelector('script[src*="main-"]');
    if (!s || !s.src) return;
    fetch(s.src, { method: "HEAD", cache: "no-store", credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) heal("main-head");
      })
      .catch(function () {
        heal("main-head");
      });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", probeMain);
  } else probeMain();
})();

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