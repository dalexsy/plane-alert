const https = require('https');
const { execSync } = require('child_process');

// Use public Firestore REST API (read-only for this database)
const url = 'https://firestore.googleapis.com/v1/projects/plane-alert-800ff/databases/(default)/documents/notification-cooldowns?pageSize=50';

const options = {};

console.log('Attempting to query notification-cooldowns collection...\n');

https.get(url, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      
      if (!result.documents || result.documents.length === 0) {
        console.log('No cooldown documents found - cannot recover user key');
        process.exit(1);
      }

      console.log(`Found ${result.documents.length} cooldown documents\n`);

      // Extract user keys from document IDs
      const userKeys = new Set();
      const deviceNames = new Set();

      result.documents.forEach(doc => {
        const docId = doc.name.split('/').pop();
        console.log(`Document ID: ${docId}`);
        
        // Format: userKey__deviceName__icao or userKey__icao
        const parts = docId.split('__');
        if (parts.length >= 2) {
          const potentialUserKey = parts[0];
          userKeys.add(potentialUserKey);
          
          if (parts.length === 3) {
            deviceNames.add(parts[1]);
          }
        }
      });

      console.log('\n=== RECOVERED DATA ===');
      console.log(`\nPushover User Keys found: ${userKeys.size}`);
      userKeys.forEach(key => {
        console.log(`  ${key}`);
      });

      console.log(`\nDevice names found: ${deviceNames.size}`);
      deviceNames.forEach(name => {
        console.log(`  ${name}`);
      });

      if (userKeys.size === 1) {
        const userKey = Array.from(userKeys)[0];
        console.log(`\n✅ SINGLE USER KEY CONFIRMED: ${userKey}`);
        console.log('\nTo restore your notifications:');
        console.log('1. Open https://plane-alert.surge.sh on each device');
        console.log('2. Enter this Pushover User Key in settings');
        console.log(`3. Save to re-register each device`);
      }

    } catch (err) {
      console.error('Error parsing response:', err.message);
      console.log('Raw response:', data.substring(0, 500));
    }
  });
}).on('error', err => {
  console.error('Request error:', err.message);
});
