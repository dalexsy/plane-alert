export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: 'AIzaSyCaMOUDaRPIFmCjHTiIOiFtMxdR3lWMDUw',
  authDomain: 'plane-alert-800ff.firebaseapp.com',
  projectId: 'plane-alert-800ff',
  storageBucket: 'plane-alert-800ff.firebasestorage.app',
  messagingSenderId: '698615469333',
  appId: '1:698615469333:web:16aa74b0ae76832410451c',
};

export const firebaseVapidKey =
  'BEsZsblwDqmgC1mKRQzv6cQ9rqAvdfXEpsoK7XeVL8PdYOwiJANmvpnaFBwZn4vFKdPgrs75iomO6mA4vdWwadU';

const planesApiBase = '/api/planes';

export const pushRegistrationEndpoint = `${planesApiBase}/registerDevice`;

export const pushCheckDeviceEndpoint = `${planesApiBase}/checkDevice`;

export const adsbPointProxyUrl = `${planesApiBase}/adsbPointProxy`;

export const getMilitaryHistoryEndpoint = `${planesApiBase}/getMilitaryHistory`;

export const saveMilitarySightingEndpoint = `${planesApiBase}/saveMilitarySighting`;
