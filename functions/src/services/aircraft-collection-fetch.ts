import { logger } from '../pi-logger';
import type { AdsBPlane } from '@plane-alert/shared';
import type { Location } from '../types';
import { fetchAdsbPointNonEmpty } from './aircraft-adsb-point';

export async function fetchAircraftForCollection(
  location: Location,
  radiusKm: number,
): Promise<AdsBPlane[] | null> {
  const ac = await fetchAdsbPointNonEmpty(location.lat, location.lon, radiusKm);
  if (ac?.length) return ac;

  // Do not fall back to OpenSky for scheduled collection: OpenSky lacks mil/dbFlags
  // and would overwrite good snapshots, breaking military push notifications.
  logger.error('All ADS-B sources failed or empty for collection', {
    location,
    radiusKm,
  });
  return null;
}

export {
  fetchMilitaryAircraftInRadius,
  fetchAircraftRingAroundHome,
} from './aircraft-mil-and-ring-fetch';
