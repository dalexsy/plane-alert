// Load environment variables from .env file
import * as dotenv from 'dotenv';
dotenv.config();

import * as admin from 'firebase-admin';
import * as countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';

// Register English locale for country names
countries.registerLocale(en);

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

// Import and create device management functions
import { createDeviceManagementFunctions } from './device-management';
const deviceFunctions = createDeviceManagementFunctions(db);

export const registerDevice = deviceFunctions.registerDevice;
export const checkDevice = deviceFunctions.checkDevice;
export const listAllDevices = deviceFunctions.listAllDevices;
export const unsubscribeDevice = deviceFunctions.unsubscribeDevice;
export const debugListTokens = deviceFunctions.debugListTokens;
export const debugSendToken = deviceFunctions.debugSendToken;

// Import and create aircraft collection function
import { createAircraftCollectionFunction } from './aircraft-collection';
export const collectAircraftData = createAircraftCollectionFunction(db);

// Import and create notification processor function
import { createNotificationProcessorFunction } from './notification-processor';
export const processPlanes = createNotificationProcessorFunction(db);
