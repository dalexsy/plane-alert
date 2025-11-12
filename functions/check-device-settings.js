// Quick script to check device settings in Firestore
const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'plane-alert-800ff'
});

const db = admin.firestore();

async function checkDevice() {
  const deviceId = 'u4h7b5hnvdgvozqd5yzm86i474fs4g__default';
  const doc = await db.collection('devices').doc(deviceId).get();
  
  if (!doc.exists) {
    console.log('Device not found!');
    return;
  }
  
  const data = doc.data();
  console.log('\nDevice:', deviceId);
  console.log('notifyProximity:', data.notifyProximity);
  console.log('ignoredTypes:', data.ignoredTypes);
  console.log('home:', data.home);
  console.log('radiusKm:', data.radiusKm);
  
  process.exit(0);
}

checkDevice().catch(console.error);
