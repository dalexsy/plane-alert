import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import fetch from 'node-fetch';

// OpenSky uses OAuth2 client credentials that must be exchanged for an access token
const OPENSKY_CLIENT_ID = process.env.OPENSKY_CLIENT_ID;
const OPENSKY_CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET;

interface OpenSkyTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;
const TOKEN_ENDPOINT =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  if (!OPENSKY_CLIENT_ID || !OPENSKY_CLIENT_SECRET) {
    throw new Error('OpenSky client credentials are not configured.');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: OPENSKY_CLIENT_ID,
    client_secret: OPENSKY_CLIENT_SECRET,
  });

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    timeout: 8000,
  } as any);

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(
      `Failed to obtain OpenSky token: ${tokenResponse.status} - ${errorText}`,
    );
  }

  const tokenData = (await tokenResponse.json()) as OpenSkyTokenResponse;

  if (!tokenData.access_token || !tokenData.expires_in) {
    throw new Error('OpenSky token response missing required fields.');
  }

  cachedToken = {
    value: tokenData.access_token,
    // Subtract 60s to refresh token slightly before expiration
    expiresAt: Date.now() + (tokenData.expires_in - 60) * 1000,
  };

  return cachedToken.value;
}

interface OpenSkyFlight {
  icao24: string;
  firstSeen: number;
  estDepartureAirport: string | null;
  lastSeen: number;
  estArrivalAirport: string | null;
  callsign: string;
}

/**
 * Proxy for OpenSky Network API to bypass CORS restrictions
 * GET /opensky-proxy?icao24=<hex>
 */
export const openskyProxy = onRequest(
  {
    cors: true,
    timeoutSeconds: 10,
    region: 'europe-west3',
  },
  async (req, res) => {
    // Only allow GET requests
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const icao24 = req.query.icao24 as string;

    if (!icao24 || typeof icao24 !== 'string') {
      res.status(400).json({ error: 'Missing icao24 parameter' });
      return;
    }

    try {
      const icaoLower = icao24.toLowerCase();
      const endTime = Math.floor(Date.now() / 1000);
      const beginTime = endTime - 86400; // 24 hours ago

      const url = `https://opensky-network.org/api/flights/aircraft?icao24=${icaoLower}&begin=${beginTime}&end=${endTime}`;

      const fetchFlights = async () => {
        const accessToken = await getAccessToken();
        logger.info(`Fetching route data for ${icao24} using OAuth token`);
        return fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'PlaneAlert/1.0',
          },
          timeout: 8000,
        } as any);
      };

      let response = await fetchFlights();

      if (response.status === 401) {
        // Token may be expired; clear cache and retry once
        cachedToken = null;
        response = await fetchFlights();
      }

      if (response.status === 404) {
        logger.info(`No OpenSky flights found for ${icao24}`);
        res.json({ origin: null, destination: null });
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn(
          `OpenSky API error for ${icao24}: ${response.status} - ${errorText}`,
        );
        res
          .status(response.status)
          .json({ error: 'OpenSky API error', details: response.status });
        return;
      }

      const flights = (await response.json()) as OpenSkyFlight[];

      // Return simplified response
      if (!flights || flights.length === 0) {
        res.json({ origin: null, destination: null });
        return;
      }

      // Get most recent flight
      const recentFlight = flights.reduce((latest, current) =>
        current.lastSeen > latest.lastSeen ? current : latest,
      );

      res.json({
        origin: recentFlight.estDepartureAirport || null,
        destination: recentFlight.estArrivalAirport || null,
        departureTime: recentFlight.firstSeen,
        arrivalTime: recentFlight.lastSeen,
      });
    } catch (error: any) {
      logger.error(`OpenSky proxy error for ${icao24}:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);
