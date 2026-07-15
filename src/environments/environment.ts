/** Dev: same-origin /api/planes via proxy → Pi backend (not Cloud Functions). */
export const environment = {
  production: false,
  endpoints: {
    registerDevice: '/api/planes/registerDevice',
    collectAircraftOnDemand: '/api/planes/collectAircraftOnDemand',
    checkDevice: '/api/planes/checkDevice',
    unsubscribeDevice: '/api/planes/unsubscribeDevice',
    openskyProxy: '/api/planes/openskyProxy',
    weatherCeiling: '/api/planes/weatherCeilingProxy',
    saveMilitarySighting: '/api/planes/saveMilitarySighting',
    getMilitaryHistory: '/api/planes/getMilitaryHistory',
    adsbPointProxy: '/api/planes/adsbPointProxy',
    reverseGeocode: '/api/planes/reverseGeocode',
  },
};
