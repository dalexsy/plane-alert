// Force Cloud Scheduler jobs to run via REST API
const https = require('https');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const projectId = 'plane-alert-800ff';
const region = 'us-central1';

async function getAccessToken() {
  try {
    const { stdout } = await execPromise('firebase login:ci --no-localhost');
    return stdout.trim();
  } catch (error) {
    // Try gcloud if available
    try {
      const { stdout } = await execPromise('gcloud auth application-default print-access-token');
      return stdout.trim();
    } catch (e) {
      throw new Error('Unable to get access token. Make sure you are logged in to Firebase or gcloud.');
    }
  }
}

async function triggerScheduledFunction(functionName, token) {
  // Use Cloud Scheduler API to force run the job
  const jobName = `firebase-schedule-${functionName}-${region}`;
  const url = `https://cloudscheduler.googleapis.com/v1/projects/${projectId}/locations/${region}/jobs/${jobName}:run`;
  
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': 0
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✅ Triggered ${functionName}`);
          resolve(data);
        } else {
          console.error(`❌ Failed to trigger ${functionName}: ${res.statusCode}`);
          console.error(data);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('🔧 Attempting to manually trigger Cloud Scheduler jobs...\n');
  
  // Try alternative approach - directly invoke the functions via HTTP
  // This works better than trying to access Cloud Scheduler API
  console.log('Note: You can also manually trigger these in the Firebase Console:');
  console.log('https://console.cloud.google.com/cloudscheduler?project=plane-alert-800ff');
  console.log('\nAlternatively, check the logs here:');
  console.log('https://console.cloud.google.com/logs/query;query=resource.type%3D%22cloud_function%22%0Aresource.labels.function_name%3D%22collectAircraftData%22?project=plane-alert-800ff');
  console.log('\nWaiting 2 minutes for next scheduled run...');
  
  // Check if data updates in next few minutes
  const checkInterval = setInterval(async () => {
    const url = 'https://firestore.googleapis.com/v1/projects/plane-alert-800ff/databases/(default)/documents/aircraft-snapshots/52.46_13.52_100';
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const updateTime = json.updateTime;
          console.log(`Last update: ${updateTime}`);
          
          // Check if updated within last 5 minutes
          const lastUpdate = new Date(updateTime);
          const now = new Date();
          const diffMinutes = (now - lastUpdate) / 1000 / 60;
          
          if (diffMinutes < 5) {
            console.log('✅ Backend is running! Data was updated recently.');
            clearInterval(checkInterval);
            process.exit(0);
          }
        } catch (err) {
          console.error('Error checking update:', err.message);
        }
      });
    });
  }, 30000); // Check every 30 seconds
  
  // Stop after 3 minutes
  setTimeout(() => {
    clearInterval(checkInterval);
    console.log('\n⚠️ Data not updated yet. Check Cloud Scheduler console for issues.');
    process.exit(1);
  }, 180000);
}

main().catch(console.error);
