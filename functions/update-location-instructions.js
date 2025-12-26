// Quick script to update device location using Firebase CLI
// Run with: firebase functions:shell

const deviceId = 'u4h7b5hnvdgvozqd5yzm86i474fs4g__galaxys24';

// Dieselstraße 8, Unterföhring, 85774
const newLocation = {
  lat: 48.1896,
  lon: 11.6490
};

console.log('Run this in Firebase Functions shell:');
console.log('');
console.log('firebase functions:shell --project plane-alert-800ff');
console.log('');
console.log('Then paste:');
console.log('');
console.log(`const admin = require('firebase-admin');`);
console.log(`const db = admin.firestore();`);
console.log(`db.collection('devices').doc('${deviceId}').update({ location: { lat: ${newLocation.lat}, lon: ${newLocation.lon} }, updatedAt: admin.firestore.FieldValue.serverTimestamp() }).then(() => console.log('✅ Updated!')).catch(console.error);`);
