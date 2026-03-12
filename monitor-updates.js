// Check and display current aircraft snapshot status
const https = require('https');

const projectId = 'plane-alert-800ff';
const location = '52.46_13.52_100';

async function checkSnapshot() {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/aircraft-snapshots/${location}`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function monitor() {
  console.log('📊 Monitoring aircraft data updates...\n');
  console.log('Checking every 30 seconds for updates.\n');
  
  let lastUpdate = null;
  let checkCount = 0;
  const maxChecks = 6; // 3 minutes total
  
  const check = async () => {
    checkCount++;
    
    try {
      const snapshot = await checkSnapshot();
      const updateTime = snapshot.updateTime;
      const lastUpdateField = snapshot.fields?.lastUpdate?.stringValue || 'unknown';
      const count = snapshot.fields?.count?.integerValue || '0';
      
      const updateDate = new Date(updateTime);
      const now = new Date();
      const ageMinutes = ((now - updateDate) / 1000 / 60).toFixed(1);
      
      console.log(`[${new Date().toISOString()}]`);
      console.log(`  Firestore updateTime: ${updateTime}`);
      console.log(`  Data field lastUpdate: ${lastUpdateField}`);
      console.log(`  Aircraft count: ${count}`);
      console.log(`  Age: ${ageMinutes} minutes`);
      
      if (lastUpdate && lastUpdate !== updateTime) {
        console.log('\n✅ SUCCESS! Data updated!');
        console.log('Backend is now running.\n');
        process.exit(0);
      }
      
      lastUpdate = updateTime;
      
      if (checkCount >= maxChecks) {
        console.log(`\n⚠️ No updates detected after ${maxChecks} checks.`);
        console.log('Please check Cloud Scheduler manually:');
        console.log('https://console.cloud.google.com/cloudscheduler?project=plane-alert-800ff\n');
        process.exit(1);
      }
      
      console.log('');
    } catch (err) {
      console.error('Error:', err.message);
    }
  };
  
  // Initial check
  await check();
  
  // Check every 30 seconds
  const interval = setInterval(check, 30000);
}

monitor().catch(console.error);
