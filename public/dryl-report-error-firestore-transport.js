/**
 * Report Firestore fetch/XHR failures (e.g. ad-blocker ERR_BLOCKED_BY_CLIENT).
 * Loads after dryl-report-error.js; skips Listen channel TYPE=terminate teardown.
 */
(function () {
  "use strict";

  function requestUrl(input) {
    if (typeof input === "string") return input;
    if (input && typeof input.url === "string") return input.url;
    return "";
  }

  function isFirestoreUrl(url) {
    return /firestore\.googleapis\.com/i.test(String(url || ""));
  }

  function isAbortError(err) {
    if (!err) return false;
    if (err.name === "AbortError") return true;
    var msg = err && err.message ? String(err.message) : String(err || "");
    return /signal is aborted|aborted without reason/i.test(msg);
  }

  function reportFirestoreTransportFailure(url, err, transport) {
    if (typeof window.drylReportError !== "function") return;
    if (isAbortError(err)) return;
    var path = String(url || "").slice(0, 400);
    if (/TYPE=terminate/i.test(path)) return;
    var msg =
      err && err.message ? err.message : String(err || "Firestore request failed");
    window.drylReportError(
      msg,
      {
        source: "app-report-firestore-blocked",
        firestoreUrl: path,
        transport: transport || "fetch",
      },
      "warn",
    );
  }

  function reportFirestoreQuotaError(url, status) {
    if (typeof window.drylReportError !== "function") return;
    var path = String(url || "").slice(0, 400);
    if (/TYPE=terminate/i.test(path)) return;
    window.drylReportError(
      "Firestore quota exceeded (HTTP " + status + ") — reads throttled",
      {
        source: "app-report-firestore-quota",
        firestoreUrl: path,
        httpStatus: status,
      },
      "warn",
    );
  }

  function installHooks() {
    if (typeof window.fetch === "function" && !window.__drylFirestoreFetchHook__) {
      window.__drylFirestoreFetchHook__ = true;
      var nativeFetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        var url = requestUrl(input);
        return nativeFetch(input, init).then(function (res) {
          if (isFirestoreUrl(url) && (res.status === 429 || res.status === 503)) {
            reportFirestoreQuotaError(url, res.status);
          }
          return res;
        }).catch(function (err) {
          if (isFirestoreUrl(url)) {
            reportFirestoreTransportFailure(url, err, "fetch");
          }
          throw err;
        });
      };
    }

    if (typeof XMLHttpRequest !== "undefined" && !window.__drylFirestoreXhrHook__) {
      window.__drylFirestoreXhrHook__ = true;
      var NativeXHR = XMLHttpRequest.prototype;
      var nativeOpen = NativeXHR.open;
      NativeXHR.open = function (method, url) {
        this.__drylFirestoreUrl = String(url || "");
        return nativeOpen.apply(this, arguments);
      };
      var nativeSend = NativeXHR.send;
      NativeXHR.send = function () {
        var openUrl = this.__drylFirestoreUrl || "";
        if (isFirestoreUrl(openUrl)) {
          this.addEventListener("error", function () {
            reportFirestoreTransportFailure(
              openUrl,
              "Firestore transport failed (may be blocked by client)",
              "xhr",
            );
          });
          this.addEventListener("loadend", function () {
            if (this.status === 429 || this.status === 503) {
              reportFirestoreQuotaError(openUrl, this.status);
            }
          });
        }
        return nativeSend.apply(this, arguments);
      };
    }
  }

  function boot() {
    if (typeof window.drylReportError !== "function") {
      setTimeout(boot, 50);
      return;
    }
    installHooks();
  }

  boot();
})();
