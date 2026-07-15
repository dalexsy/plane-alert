/** Production: nginx proxies /api/planes/* to Pi planes-api (never cloudfunctions.net). */
export const environment = {
  production: true,
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
  },
};
