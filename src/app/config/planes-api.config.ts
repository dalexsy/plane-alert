/** Planes API endpoints (Pi / nginx proxy). No third-party cloud IdP. */

const planesApiBase = '/api/planes';

export const pushRegistrationEndpoint = `${planesApiBase}/registerDevice`;

export const pushCheckDeviceEndpoint = `${planesApiBase}/checkDevice`;

export const adsbPointProxyUrl = `${planesApiBase}/adsbPointProxy`;

export const getMilitaryHistoryEndpoint = `${planesApiBase}/getMilitaryHistory`;

export const saveMilitarySightingEndpoint = `${planesApiBase}/saveMilitarySighting`;

export const antennaSightingsEndpoint = `${planesApiBase}/antennaSightings`;
