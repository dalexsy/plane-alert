# AeroAPI Integration - Deployment Guide

## Overview

Added FlightAware AeroAPI integration to enrich aircraft notifications with origin/destination/ETA data.

## Changes Made

### Backend (Firebase Functions)

1. **New Services:**

   - `functions/src/services/aeroapi-client.ts` - AeroAPI HTTP client
   - `functions/src/services/flight-data-cache.ts` - Firestore caching layer

2. **Modified Files:**

   - `functions/src/aircraft-collection.ts` - Enriches snapshots with flight data
   - `functions/src/notification-processor.ts` - Passes flight data to notifications
   - `functions/src/services/notification-builder.ts` - Formats O/D/ETA in notification body

3. **Shared Package:**
   - `shared/src/notification-formatter.ts` - Added `route` field to NotificationData interface

## Deployment Steps

### 1. Set Firebase Functions Environment Variable

```powershell
# Navigate to functions directory
cd functions

# Set AeroAPI key
firebase functions:config:set aeroapi.key="tlgsmPPCIsgFIG0T6VjlgjEguCImDEXi"

# Verify it's set
firebase functions:config:get
```

### 2. Deploy Backend Functions

```powershell
# From workspace root
npm run deploy:functions

# OR deploy all (frontend + backend)
npm run deploy:all
```

### 3. Test Notifications

After deployment, wait for aircraft to appear and trigger notifications. Check notification bodies for route info like:

```
UAL2463: RDU→IAD (ETA 21:16 UTC) • 15 km away at 8000 ft
```

## Cost Monitoring

### Expected Usage

- **Conservative:** 20 new aircraft/day = $3/month
- **Moderate:** 40 new aircraft/day = $6/month
- **Busy:** 65 new aircraft/day = $9.75/month

### Check Usage

Monitor at: https://www.flightaware.com/aeroapi/portal

### Budget Alerts

- Personal tier: $10/month free credit (ADS-B feeder)
- Queries charged at $0.005 per result set (15 records)

## How It Works

1. **Aircraft Collection (every minute):**

   - Fetches aircraft from ADS-B One (free)
   - For each aircraft with a callsign, queries AeroAPI
   - Caches results in Firestore (6-hour TTL, keyed by callsign+date)
   - Stores enriched data in `aircraft-snapshots` collection

2. **Notification Processing:**

   - Loads cached flight data from Firestore
   - Enriches notification body with O/D/ETA
   - Example: "UAL2463: RDU→IAD (ETA 21:16 UTC) • ..."

3. **Caching Strategy:**
   - Cache key: `{CALLSIGN}_{YYYY-MM-DD}`
   - TTL: 6 hours (typical flight duration)
   - Same flight tomorrow = new query (fresh data)
   - No data = cached as null (avoid repeated queries)

## Firestore Collections

### `flight-data-cache`

Stores AeroAPI responses keyed by callsign+date:

```typescript
{
  cacheKey: "UAL2463_2026-01-12",
  cachedAt: 1736712000000,
  ident: "UAL2463",
  origin: { code: "KRDU", name: "Raleigh-Durham Intl", city: "Raleigh/Durham" },
  destination: { code: "KIAD", name: "Washington Dulles Intl", city: "Washington" },
  estimatedIn: "2026-01-12T21:16:00Z",
  status: "En Route",
  // ... more fields
}
```

## Troubleshooting

### No route data in notifications

1. Check Functions logs: `firebase functions:log`
2. Verify AEROAPI_KEY is set: `firebase functions:config:get`
3. Check Firestore `flight-data-cache` collection for entries
4. Verify aircraft have callsigns (military flights may not have O/D data)

### High API costs

1. Monitor at: https://www.flightaware.com/aeroapi/portal
2. Check cache hit rate in Functions logs
3. Adjust cache TTL in `flight-data-cache.ts` if needed

### Missing data for specific flights

- Commercial airlines: Should have full O/D data
- Military flights: Often return empty (operational security)
- General aviation: May not file public flight plans

## Rollback

To disable AeroAPI integration without redeploying:

```powershell
# Remove API key
firebase functions:config:unset aeroapi.key

# Functions will gracefully skip AeroAPI queries if key is missing
```

## Future Enhancements

1. **Frontend Display:**

   - Show O/D/ETA in aircraft tooltips
   - Add route info to list items
   - Display ETA countdown timer

2. **Cache Optimization:**

   - Cleanup job for expired entries
   - Per-flight caching using `fa_flight_id`

3. **Advanced Features:**
   - Flight delay alerts
   - Diversion/cancellation notifications
   - Gate change alerts
