const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BERLIN_LAT = 52.5200;
const BERLIN_LON = 13.4050;
const RADIUS_KM = 100;

async function checkPlanes() {
  const radiusNm = RADIUS_KM / 1.852;
  const url = `https://api.adsb.one/v2/point/${BERLIN_LAT}/${BERLIN_LON}/${radiusNm.toFixed(2)}`;

  console.log(`🔍 Checking aircraft near Berlin (${RADIUS_KM}km radius)...`);
  console.log(`📡 API URL: ${url}\n`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'plane-alert.surge.sh',
      'Accept': 'application/json',
    },
    timeout: 10000,
  });

  if (!response.ok) {
    console.error('❌ API Error:', response.status, response.statusText);
    return;
  }

  const data = await response.json();
  const aircraft = data.ac || [];

  console.log(`📊 Total aircraft found: ${aircraft.length}\n`);

  // Check for military aircraft
  const militaryPlanes = aircraft.filter(plane => {
    // Check if it looks military based on mil flag OR dbFlags
    const hasMilFlag = plane.mil === true;
    const hasDbFlags = plane.dbFlags === 1;
    
    return hasMilFlag || hasDbFlags;
  });

  console.log(`🎯 Military aircraft found: ${militaryPlanes.length}\n`);

  if (militaryPlanes.length > 0) {
    console.log('Military Aircraft Details:');
    console.log('─'.repeat(80));
    
    militaryPlanes.forEach((plane, index) => {
      console.log(`\n[${index + 1}] ICAO: ${plane.hex}`);
      console.log(`    Callsign: ${plane.flight || 'N/A'}`);
      console.log(`    Type: ${plane.t || 'N/A'}`);
      console.log(`    Description: ${plane.desc || 'N/A'}`);
      console.log(`    mil flag: ${plane.mil}`);
      console.log(`    dbFlags: ${plane.dbFlags}`);
      console.log(`    Position: ${plane.lat}, ${plane.lon}`);
      console.log(`    Altitude: ${plane.alt_baro} ft`);
      console.log(`    Speed: ${plane.gs} kts`);
    });
  }

  // Show a few non-military for comparison
  const nonMilitary = aircraft.filter(plane => {
    const hasMilFlag = plane.mil === true;
    const hasDbFlags = plane.dbFlags === 1;
    return !(hasMilFlag || hasDbFlags);
  }).slice(0, 3);

  if (nonMilitary.length > 0) {
    console.log('\n\n' + '─'.repeat(80));
    console.log('Sample Non-Military Aircraft (for comparison):');
    console.log('─'.repeat(80));
    
    nonMilitary.forEach((plane, index) => {
      console.log(`\n[${index + 1}] ICAO: ${plane.hex}`);
      console.log(`    Callsign: ${plane.flight || 'N/A'}`);
      console.log(`    Type: ${plane.t || 'N/A'}`);
      console.log(`    mil flag: ${plane.mil}`);
      console.log(`    dbFlags: ${plane.dbFlags}`);
    });
  }
}

checkPlanes().catch(console.error);
