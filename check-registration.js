// Check what's stored in Firestore for your device registration
const admin = require('firebase-admin');
const serviceAccount = require('./functions/service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkRegistration() {
  console.log('🔍 Checking device registrations...\n');
  
  const snapshot = await db.collection('deviceRegistrations').get();
  
  if (snapshot.empty) {
    console.log('❌ No registrations found!');
    return;
  }
  
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log('📱 Device ID:', doc.id);
    console.log('   Pushover Key:', data.pushoverUserKey?.slice(0, 8) + '...');
    console.log('   Home Location:', data.home);
    console.log('   Radius:', data.radiusKm, 'km');
    console.log('   Distance Unit:', data.distanceUnit);
    console.log('   Last Notified Aircraft:');
    
    if (data.lastNotified && Object.keys(data.lastNotified).length > 0) {
      for (const [icao, timestamp] of Object.entries(data.lastNotified)) {
        const date = new Date(timestamp);
        const minutesAgo = Math.floor((Date.now() - timestamp) / 1000 / 60);
        console.log(`     ${icao}: ${date.toLocaleString()} (${minutesAgo} minutes ago)`);
      }
    } else {
      console.log('     (none)');
    }
    console.log('');
  });
}

checkRegistration().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
