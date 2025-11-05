// Test script to check what aircraft are currently being detected
// This simulates what the Cloud Function does

const BORING_AIRCRAFT_TYPES = [
  'BE20', 'BE30', 'BE35', 'BE36', 'BE40', 'BE45', 'BE9L', 'BE9T',
  'C172', 'C182', 'C208', 'C25A', 'C25B', 'C25C', 'C501', 'C510',
  'C525', 'C550', 'C551', 'C560', 'C56X', 'C650', 'C680', 'C750',
  'CL30', 'CL35', 'CL60', 'DHC6', 'DHC8', 'E50P', 'E55P',
  'FA7X', 'FA10', 'FA20', 'FA50', 'FA2T', 'GL5T', 'GLEX',
  'GLF4', 'GLF5', 'GLF6', 'GLHF', 'LJ24', 'LJ25', 'LJ31',
  'LJ35', 'LJ40', 'LJ45', 'LJ55', 'LJ60', 'P28A', 'PC12',
  'PC21', 'PC6', 'PC9', 'SF50', 'T134', 'T154',
];

async function checkAircraft(lat, lon, radiusKm) {
  const radiusNm = radiusKm / 1.852;
  const url = `https://api.adsb.one/v2/point/${lat}/${lon}/${radiusNm.toFixed(2)}`;

  console.log(`\nFetching aircraft within ${radiusKm}km of ${lat}, ${lon}...`);
  console.log(`URL: ${url}\n`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PlaneAlertTest/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const aircraft = data.ac || [];

    console.log(`📊 Total aircraft found: ${aircraft.length}\n`);

    const militaryAircraft = aircraft.filter(plane => plane.mil === true);
    console.log(`✈️  Military aircraft (mil=true): ${militaryAircraft.length}\n`);

    if (militaryAircraft.length > 0) {
      console.log('Military aircraft details:');
      console.log('─'.repeat(80));
      
      for (const plane of militaryAircraft) {
        const icao = plane.hex?.toUpperCase() || 'unknown';
        const aircraftType = plane.t || plane.type || 'unknown';
        const isBoring = BORING_AIRCRAFT_TYPES.includes(aircraftType.toUpperCase());
        const reg = plane.r || 'N/A';
        const alt = plane.alt_baro || plane.alt_geom || 'N/A';
        const flight = plane.flight?.trim() || 'N/A';
        
        console.log(`\nICAO: ${icao}`);
        console.log(`  Type: ${aircraftType} ${isBoring ? '⚠️  FILTERED (boring)' : '✅ INTERESTING'}`);
        console.log(`  Registration: ${reg}`);
        console.log(`  Flight: ${flight}`);
        console.log(`  Altitude: ${alt} ft`);
        console.log(`  Position: ${plane.lat}, ${plane.lon}`);
      }
      
      const interesting = militaryAircraft.filter(plane => {
        const aircraftType = plane.t || plane.type || '';
        return !BORING_AIRCRAFT_TYPES.includes(aircraftType.toUpperCase());
      });
      
      console.log('\n' + '─'.repeat(80));
      console.log(`\n🎯 Interesting military aircraft: ${interesting.length}`);
      console.log(`⚠️  Filtered out (boring): ${militaryAircraft.length - interesting.length}`);
    } else {
      console.log('No military aircraft detected in this area.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Get location from command line or use RAF Mildenhall as default
const lat = process.argv[2] ? parseFloat(process.argv[2]) : 52.3619; // RAF Mildenhall
const lon = process.argv[3] ? parseFloat(process.argv[3]) : 0.4861;
const radiusKm = process.argv[4] ? parseFloat(process.argv[4]) : 100;

console.log('🛩️  Plane Alert - Aircraft Detection Test\n');
checkAircraft(lat, lon, radiusKm);
