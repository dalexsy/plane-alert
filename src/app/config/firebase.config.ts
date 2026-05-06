import { environment } from '../../environments/environment';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const firebaseConfig: FirebaseConfig = environment.firebase;
export const firebaseVapidKey = environment.vapidKey;
export const pushRegistrationEndpoint = environment.endpoints.registerDevice;
export const aircraftOnDemandEndpoint =
  environment.endpoints.collectAircraftOnDemand;
export const checkDeviceEndpoint = environment.endpoints.checkDevice;
export const weatherCeilingEndpoint = environment.endpoints.weatherCeiling;
