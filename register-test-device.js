// Manual device registration for testing
// This will create a dummy device registration so the backend starts collecting data

const https = require('https');

const deviceId = 'test-browser-' + Date.now();
const lat = 52.46;
const lon = 13.52;
const radiusKm = 100;

const payload = JSON.stringify({
  pushoverUserKey: 'test123456789',  // Dummy key for testing
  deviceName: 'Test Device',
  location: { lat, lon },
  radiusKm,
  notifyProximity: true,
  notifyMilitary: true,
  notifySpecial: true,
  platform: 'web',
  distanceUnit: 'km'
});

console.log('Registering test device...\n');
console.log(`Device ID: ${deviceId}`);
console.log(`Location: ${lat}, ${lon}`);
console.log(`Radius: ${radiusKm} km\n`);

const req = https.request('https://us-central1-plane-alert-800ff.cloudfunctions.net/registerDevice', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response status:', res.statusCode);
    console.log('Response:', data);
    
    if (res.statusCode === 200) {
      console.log('\n✅ Device registered successfully!');
      console.log('The backend should start collecting data within 1 minute.');
      console.log('\nWait 2 minutes, then check:');
      console.log('  node monitor-updates.js');
    } else {
      console.log('\n❌ Registration failed');
    }
  });
});

req.on('error', err => console.error('Error:', err));
req.write(payload);
req.end();
