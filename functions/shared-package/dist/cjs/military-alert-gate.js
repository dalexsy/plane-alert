"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldAlertForAircraft = shouldAlertForAircraft;
exports.planeFieldsToAdsB = planeFieldsToAdsB;
const military_detection_1 = require("./military-detection");
/**
 * Single alert gate for Pushover and audio (kiosk PipeWire, SPA MP3/TTS).
 * Special always alerts. Otherwise: military candidate and not boring.
 */
function shouldAlertForAircraft(plane, options) {
    if (options?.isSpecial) {
        return true;
    }
    const callsign = plane.flight || plane.callsign;
    const isMilitaryCandidate = (0, military_detection_1.looksMilitary)(plane) ||
        (0, military_detection_1.isMilitaryCallsign)(callsign) ||
        plane.mil === true ||
        plane.dbFlags === 1;
    if (!isMilitaryCandidate) {
        return false;
    }
    return !(0, military_detection_1.isBoringMilitaryAircraft)(plane);
}
/** SPA plane fields → AdsBPlane so the shared gate runs without a second filter. */
function planeFieldsToAdsB(fields) {
    const mil = fields.isMilitary === true;
    return {
        hex: fields.icao,
        flight: fields.callsign,
        callsign: fields.callsign,
        desc: fields.model,
        t: fields.type,
        mil: mil || undefined,
        dbFlags: mil ? 1 : undefined,
    };
}
//# sourceMappingURL=military-alert-gate.js.map