export const environment = {
  production: true,
  firebase: {
    apiKey: 'AIzaSyCaMOUDaRPIFmCjHTiIOiFtMxdR3lWMDUw',
    authDomain: 'plane-alert-800ff.firebaseapp.com',
    projectId: 'plane-alert-800ff',
    storageBucket: 'plane-alert-800ff.firebasestorage.app',
    messagingSenderId: '698615469333',
    appId: '1:698615469333:web:16aa74b0ae76832410451c',
  },
  vapidKey:
    'BEsZsblwDqmgC1mKRQzv6cQ9rqAvdfXEpsoK7XeVL8PdYOwiJANmvpnaFBwZn4vFKdPgrs75iomO6mA4vdWwadU',
  endpoints: {
    registerDevice:
      'https://europe-west3-plane-alert-800ff.cloudfunctions.net/registerDevice',
    collectAircraftOnDemand:
      'https://europe-west3-plane-alert-800ff.cloudfunctions.net/collectAircraftOnDemand',
    checkDevice:
      'https://europe-west3-plane-alert-800ff.cloudfunctions.net/checkDevice',
    unsubscribeDevice:
      'https://europe-west3-plane-alert-800ff.cloudfunctions.net/unsubscribeDevice',
    openskyProxy:
      'https://europe-west3-plane-alert-800ff.cloudfunctions.net/openskyProxy',
    weatherCeiling: 'https://weatherceilingproxy-wmktwp72xq-ey.a.run.app',
    saveMilitarySighting:
      'https://savemilitarysighting-wmktwp72xq-ey.a.run.app',
    getMilitaryHistory: 'https://getmilitaryhistory-wmktwp72xq-ey.a.run.app',
  },
};
