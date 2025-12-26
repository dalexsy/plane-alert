// Check Galaxy location
const https = require('https');

const checkData = {
  pushoverUserKey: 'u4h7b5hnvdgvozqd5yzm86i474fs4g'
};

const data = JSON.stringify(checkData);

const options = {
  hostname: 'checkdevice-wmktwp72xq-uc.a.run.app',
  path: '/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('📱 Checking Galaxy S24 location...');

const req = https.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsed = JSON.parse(responseData);
      const galaxy = parsed.devices.find(d => d.deviceName === 'galaxys24');
      const pixel = parsed.devices.find(d => d.deviceName === 'pixel5');
      
      if (galaxy) {
        console.log('\n✅ Galaxy S24 location:');
        console.log('   Coordinates:', galaxy.config.location);
        console.log('   Radius:', galaxy.config.radiusKm, 'km');
      } else {
        console.log('❌ Galaxy S24 not found');
      }
      
      if (pixel) {
        console.log('\n✅ Pixel 5 location:');
        console.log('   Coordinates:', pixel.config.location);
        console.log('   Radius:', pixel.config.radiusKm, 'km');
      }
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
