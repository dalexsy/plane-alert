// Update Galaxy S24 location to Unterföhring
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, 'plane-alert-800ff-firebase-adminsdk-8tgav-00c8aae60f.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'plane-alert-800ff'
});

const db = admin.firestore();

async function updateGalaxyLocation() {
  const deviceId = 'u4h7b5hnvdgvozqd5yzm86i474fs4g__galaxys24';
  
  // Dieselstraße 8, Unterföhring, 85774 coordinates
  const newLocation = {
    lat: 48.1896,
    lon: 11.6490
  };

  try {
    // Get current device data
    const docRef = db.collection('devices').doc(deviceId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.log('❌ Device not found:', deviceId);
      return;
    }

    console.log('📱 Current device data:');
    const currentData = doc.data();
    console.log('   Device:', currentData.deviceName);
    console.log('   Current location:', currentData.location);
    
    // Update location
    await docRef.update({
      location: newLocation,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('\n✅ Location updated successfully!');
    console.log('   New location:', newLocation);
    console.log('   Address: Dieselstraße 8, Unterföhring, 85774');
    
  } catch (error) {
    console.error('❌ Error updating location:', error);
  } finally {
    process.exit(0);
  }
}

updateGalaxyLocation();
