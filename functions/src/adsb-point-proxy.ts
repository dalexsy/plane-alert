import { onRequest } from 'firebase-functions/v2/https';
import { applyCors, handleOptionsPreflight } from './http';
import { fetchAircraftForCollection } from './services/aircraft-collection-fetch';

/**
 * Proxy for ADS-B point queries so the browser avoids CORS-blocked direct API calls.
 * GET /adsbPointProxy?lat=<deg>&lon=<deg>&radiusKm=<km>
 */
export const adsbPointProxy = onRequest(
  {
    cors: true,
    timeoutSeconds: 15,
    region: 'europe-west3',
  },
  async (req, res) => {
    applyCors(res, 'GET, OPTIONS');
    if (handleOptionsPreflight(req, res)) {
      return;
    }

    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const radiusKm = Number(req.query.radiusKm);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      !Number.isFinite(radiusKm)
    ) {
      res
        .status(400)
        .json({ error: 'lat, lon, and radiusKm query parameters are required' });
      return;
    }

    const aircraft = await fetchAircraftForCollection({ lat, lon }, radiusKm);
    res.json({ ac: aircraft ?? [] });
  },
);
