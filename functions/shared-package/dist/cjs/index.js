"use strict";
/**
 * @plane-alert/shared
 *
 * Shared aircraft detection and classification logic
 * for Plane Alert frontend and backend systems
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidDeviceRegistration = exports.resolvePushoverDeliveryTarget = exports.matchPushoverDeviceName = exports.autoMatchPushoverDevice = exports.PUSHOVER_UNRELIABLE_DEVICE_NAMES = exports.DEFAULT_PUSH_DEVICE_NAMES = exports.DEFAULT_PUSH_HOME = exports.PUSHOVER_USER_KEY = exports.getAircraftTypeName = exports.AIRCRAFT_TYPE_NAMES = exports.COMMON_MILITARY_TYPES = exports.isMilitaryAircraft = exports.isAircraftMilitary = exports.createAircraftLookupMap = exports.humanReadableLocation = exports.isCoordinateLikeLocation = exports.getCountryFlagEmoji = exports.getArrowForDirection = exports.formatNotificationTitle = exports.formatNotificationBody = exports.formatDistance = exports.bearingToCardinal = exports.computeBearing = exports.haversineDistanceKm = exports.toDegrees = exports.toRadians = exports.MIL_OPERATOR_KEYWORDS = exports.MIL_CALLSIGN_PREFIXES = exports.BORING_MIL_CALLSIGN_PREFIXES = exports.BORING_AIRCRAFT_TYPES = exports.shouldSkipBoringMilitaryFilter = exports.isMilitaryOperator = exports.isBoringMilitaryCallsign = exports.isMilitaryCallsign = exports.normalizeCallsign = exports.isBoringMilitaryAircraft = exports.looksMilitary = exports.ICAO_LOOKUP_CONFIG = exports.isKnownCountry = exports.getRegistrationPrefixesForCountry = exports.getAircraftCountry = exports.getCountryFromRegistration = exports.getCountryFromIcaoHex = void 0;
// Export country detection functions
var country_detection_1 = require("./country-detection");
Object.defineProperty(exports, "getCountryFromIcaoHex", { enumerable: true, get: function () { return country_detection_1.getCountryFromIcaoHex; } });
Object.defineProperty(exports, "getCountryFromRegistration", { enumerable: true, get: function () { return country_detection_1.getCountryFromRegistration; } });
Object.defineProperty(exports, "getAircraftCountry", { enumerable: true, get: function () { return country_detection_1.getAircraftCountry; } });
Object.defineProperty(exports, "getRegistrationPrefixesForCountry", { enumerable: true, get: function () { return country_detection_1.getRegistrationPrefixesForCountry; } });
Object.defineProperty(exports, "isKnownCountry", { enumerable: true, get: function () { return country_detection_1.isKnownCountry; } });
Object.defineProperty(exports, "ICAO_LOOKUP_CONFIG", { enumerable: true, get: function () { return country_detection_1.ICAO_LOOKUP_CONFIG; } });
// Export military detection functions
var military_detection_1 = require("./military-detection");
Object.defineProperty(exports, "looksMilitary", { enumerable: true, get: function () { return military_detection_1.looksMilitary; } });
Object.defineProperty(exports, "isBoringMilitaryAircraft", { enumerable: true, get: function () { return military_detection_1.isBoringMilitaryAircraft; } });
Object.defineProperty(exports, "normalizeCallsign", { enumerable: true, get: function () { return military_detection_1.normalizeCallsign; } });
Object.defineProperty(exports, "isMilitaryCallsign", { enumerable: true, get: function () { return military_detection_1.isMilitaryCallsign; } });
Object.defineProperty(exports, "isBoringMilitaryCallsign", { enumerable: true, get: function () { return military_detection_1.isBoringMilitaryCallsign; } });
Object.defineProperty(exports, "isMilitaryOperator", { enumerable: true, get: function () { return military_detection_1.isMilitaryOperator; } });
Object.defineProperty(exports, "shouldSkipBoringMilitaryFilter", { enumerable: true, get: function () { return military_detection_1.shouldSkipBoringMilitaryFilter; } });
Object.defineProperty(exports, "BORING_AIRCRAFT_TYPES", { enumerable: true, get: function () { return military_detection_1.BORING_AIRCRAFT_TYPES; } });
Object.defineProperty(exports, "BORING_MIL_CALLSIGN_PREFIXES", { enumerable: true, get: function () { return military_detection_1.BORING_MIL_CALLSIGN_PREFIXES; } });
Object.defineProperty(exports, "MIL_CALLSIGN_PREFIXES", { enumerable: true, get: function () { return military_detection_1.MIL_CALLSIGN_PREFIXES; } });
Object.defineProperty(exports, "MIL_OPERATOR_KEYWORDS", { enumerable: true, get: function () { return military_detection_1.MIL_OPERATOR_KEYWORDS; } });
// Export geo utilities
var geo_utils_1 = require("./geo-utils");
Object.defineProperty(exports, "toRadians", { enumerable: true, get: function () { return geo_utils_1.toRadians; } });
Object.defineProperty(exports, "toDegrees", { enumerable: true, get: function () { return geo_utils_1.toDegrees; } });
Object.defineProperty(exports, "haversineDistanceKm", { enumerable: true, get: function () { return geo_utils_1.haversineDistanceKm; } });
Object.defineProperty(exports, "computeBearing", { enumerable: true, get: function () { return geo_utils_1.computeBearing; } });
Object.defineProperty(exports, "bearingToCardinal", { enumerable: true, get: function () { return geo_utils_1.bearingToCardinal; } });
Object.defineProperty(exports, "formatDistance", { enumerable: true, get: function () { return geo_utils_1.formatDistance; } });
// Export notification formatting
var notification_formatter_1 = require("./notification-formatter");
Object.defineProperty(exports, "formatNotificationBody", { enumerable: true, get: function () { return notification_formatter_1.formatNotificationBody; } });
Object.defineProperty(exports, "formatNotificationTitle", { enumerable: true, get: function () { return notification_formatter_1.formatNotificationTitle; } });
Object.defineProperty(exports, "getArrowForDirection", { enumerable: true, get: function () { return notification_formatter_1.getArrowForDirection; } });
Object.defineProperty(exports, "getCountryFlagEmoji", { enumerable: true, get: function () { return notification_formatter_1.getCountryFlagEmoji; } });
Object.defineProperty(exports, "isCoordinateLikeLocation", { enumerable: true, get: function () { return notification_formatter_1.isCoordinateLikeLocation; } });
Object.defineProperty(exports, "humanReadableLocation", { enumerable: true, get: function () { return notification_formatter_1.humanReadableLocation; } });
// Export aircraft database utilities
var aircraft_db_loader_1 = require("./aircraft-db-loader");
Object.defineProperty(exports, "createAircraftLookupMap", { enumerable: true, get: function () { return aircraft_db_loader_1.createAircraftLookupMap; } });
Object.defineProperty(exports, "isAircraftMilitary", { enumerable: true, get: function () { return aircraft_db_loader_1.isAircraftMilitary; } });
Object.defineProperty(exports, "isMilitaryAircraft", { enumerable: true, get: function () { return aircraft_db_loader_1.isMilitaryAircraft; } });
// Export military types for filtering
var military_types_1 = require("./military-types");
Object.defineProperty(exports, "COMMON_MILITARY_TYPES", { enumerable: true, get: function () { return military_types_1.COMMON_MILITARY_TYPES; } });
// Export aircraft type name mapping
var aircraft_type_names_1 = require("./aircraft-type-names");
Object.defineProperty(exports, "AIRCRAFT_TYPE_NAMES", { enumerable: true, get: function () { return aircraft_type_names_1.AIRCRAFT_TYPE_NAMES; } });
Object.defineProperty(exports, "getAircraftTypeName", { enumerable: true, get: function () { return aircraft_type_names_1.getAircraftTypeName; } });
// Household Pushover defaults (client + Pi backend)
var pushover_defaults_1 = require("./pushover-defaults");
Object.defineProperty(exports, "PUSHOVER_USER_KEY", { enumerable: true, get: function () { return pushover_defaults_1.PUSHOVER_USER_KEY; } });
Object.defineProperty(exports, "DEFAULT_PUSH_HOME", { enumerable: true, get: function () { return pushover_defaults_1.DEFAULT_PUSH_HOME; } });
Object.defineProperty(exports, "DEFAULT_PUSH_DEVICE_NAMES", { enumerable: true, get: function () { return pushover_defaults_1.DEFAULT_PUSH_DEVICE_NAMES; } });
// Pushover device matching (client + Cloud Functions)
var pushover_device_match_1 = require("./pushover-device-match");
Object.defineProperty(exports, "PUSHOVER_UNRELIABLE_DEVICE_NAMES", { enumerable: true, get: function () { return pushover_device_match_1.PUSHOVER_UNRELIABLE_DEVICE_NAMES; } });
Object.defineProperty(exports, "autoMatchPushoverDevice", { enumerable: true, get: function () { return pushover_device_match_1.autoMatchPushoverDevice; } });
Object.defineProperty(exports, "matchPushoverDeviceName", { enumerable: true, get: function () { return pushover_device_match_1.matchPushoverDeviceName; } });
Object.defineProperty(exports, "resolvePushoverDeliveryTarget", { enumerable: true, get: function () { return pushover_device_match_1.resolvePushoverDeliveryTarget; } });
Object.defineProperty(exports, "isValidDeviceRegistration", { enumerable: true, get: function () { return pushover_device_match_1.isValidDeviceRegistration; } });
//# sourceMappingURL=index.js.map