/**
 * Firestore REST serialization for dryl client error reporter.
 */
(function () {
  "use strict";

  function toFirestoreValue(value) {
    if (value === null || value === undefined) {
      return { nullValue: null };
    }
    if (typeof value === "string") {
      return { stringValue: value };
    }
    if (typeof value === "boolean") {
      return { booleanValue: value };
    }
    if (typeof value === "number") {
      return Number.isInteger(value)
        ? { integerValue: String(value) }
        : { doubleValue: value };
    }
    if (Array.isArray(value)) {
      if (value.some(function (item) { return Array.isArray(item); })) {
        try {
          return { stringValue: JSON.stringify(value).slice(0, 8000) };
        } catch {
          return { stringValue: "[array]" };
        }
      }
      return { arrayValue: { values: value.map(toFirestoreValue) } };
    }
    if (typeof value === "object") {
      return { mapValue: { fields: toFirestoreFields(value) } };
    }
    return { stringValue: String(value) };
  }

  function toFirestoreFields(obj) {
    var fields = {};
    for (var key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      if (obj[key] === undefined) continue;
      fields[key] = toFirestoreValue(obj[key]);
    }
    return fields;
  }

  function reportToFirestore(entry) {
    var config = window.__DRYL_FIREBASE_CONFIG__;
    if (!config || !config.projectId || !config.apiKey) return;
    var url =
      "https://firestore.googleapis.com/v1/projects/" +
      config.projectId +
      "/databases/(default)/documents/clientErrors?key=" +
      encodeURIComponent(config.apiKey);
    try {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: toFirestoreFields(entry) }),
        credentials: "omit",
        keepalive: true,
      }).catch(function () {});
    } catch {
      // ignore
    }
  }

  window.__drylReportToFirestore = reportToFirestore;
})();