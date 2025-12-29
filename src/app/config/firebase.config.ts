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

export const pushRegistrationEndpoint =
  'https://us-central1-plane-alert-800ff.cloudfunctions.net/registerDevice';

export const checkDeviceEndpoint =
  'https://us-central1-plane-alert-800ff.cloudfunctions.net/checkDevice';
