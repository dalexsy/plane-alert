// Simple script to update Galaxy location via the existing checkDevice API
const https = require('https');

const deviceData = {
  pushoverUserKey: 'u4h7b5hnvdgvozqd5yzm86i474fs4g',
  deviceName: 'galaxys24',
  location: {
    lat: 52.4605886,  // Berlin (same as Pixel 5)
    lon: 13.523268
  },
  radiusKm: 100,
  notifyProximity: false,
  platform: 'API Update',
  timezone: 'Europe/Berlin',
  distanceUnit: 'km',
  specialIcaos: [],
  ignoredTypes: []
};

const data = JSON.stringify(deviceData);

const options = {
  hostname: 'registerdevice-wmktwp72xq-uc.a.run.app',
  path: '/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('📱 Updating Galaxy S24 location to Unterföhring...');
console.log('   New coordinates:', deviceData.location);

const req = https.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('\n✅ Response:', responseData);
    try {
      const parsed = JSON.parse(responseData);
      console.log('\n📍 Location updated successfully!');
      console.log('   Address: Dieselstraße 8, Unterföhring, 85774');
    } catch (e) {
      console.log('Response:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error);
});

req.write(data);
req.end();
