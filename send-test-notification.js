// Send a test notification to Galaxy S24
const https = require('https');

const params = new URLSearchParams({
  token: 'a51thwyzvw24g3afcex6hf7xdnjfi9',
  user: 'u4h7b5hnvdgvozqd5yzm86i474fs4g',
  message: 'Daryl changed your location <3',
  device: 'galaxys24',
  title: '💕 Plane Alert',
  priority: '0'
});

const data = params.toString();

const options = {
  hostname: 'api.pushover.net',
  path: '/1/messages.json',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(data)
  }
};

console.log('💌 Sending notification to Galaxy S24...');

const req = https.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('\n✅ Response:', responseData);
    try {
      const parsed = JSON.parse(responseData);
      if (parsed.status === 1) {
        console.log('📱 Notification sent successfully!');
      } else {
        console.log('❌ Failed:', parsed);
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
