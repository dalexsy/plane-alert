# AeroAPI Cost Optimization

## Problem

- **345 API calls in a few hours = $1.73**
- At current rate: ~2,000-2,500 calls/day = **$10-12.50/day**
- Free tier: $25/month (5,000 calls) would run out in **2-3 days**

## Root Causes

### 1. Collection Frequency

- Cloud Function runs **every 60 seconds**
- Each run processes all aircraft with callsigns in the area
- Typical area has 30-50 aircraft → 30-50 potential API calls per minute

### 2. Cache Design

- Original TTL: 6 hours (too short for route data)
- Cache key includes date: `${callsign}_${YYYY-MM-DD}`
- Daily reset means same flight refetched multiple times per day
- No deduplication across different locations

### 3. No Selectivity

- Fetched route data for **ALL aircraft with callsigns**
- Commercial flights don't need route info (not interesting to users)
- Military/special aircraft are the primary interest

## Solutions Implemented

### 1. ✅ Increased Cache TTL (24 hours)

**Before:** 6 hours  
**After:** 24 hours

**Rationale:** Flight routes don't change mid-journey. 24-hour cache means we typically fetch each unique flight only once.

**Impact:** Reduces refetches by 75% (1 fetch/day vs 4 fetches/day)

```typescript
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
```

### 2. ✅ Daily API Call Limit

**Limit:** 500 calls per day  
**Budget:** Leaves buffer within free tier (5,000/month = ~166/day average)

**Behavior:**

- Tracks daily usage in Firestore (`aeroapi-stats` collection)
- Stops making API calls when limit reached
- Logs warning but doesn't crash (graceful degradation)
- Resets automatically at midnight UTC

**Impact:** Hard cap prevents runaway costs

```typescript
const DAILY_CALL_LIMIT = 500; // ~10% of monthly free tier per day
```

### 3. ✅ Selective Fetching (Military/Interesting Only)

**Before:** Fetched route data for all aircraft with callsigns  
**After:** Only fetch for:

- Military aircraft (`dbFlags` contains "military" or "mil")
- Interesting aircraft (`dbFlags` contains "interesting")

**Rationale:**

- 80-90% of aircraft are commercial flights
- Users care most about military/special aircraft
- Commercial route data is less critical

**Impact:** Reduces API calls by 80-90% immediately

```typescript
const callsigns = validAircraft
  .filter((plane) => {
    if (!plane.flight || !plane.flight.trim()) return false;

    const flags = plane.dbFlags || "";
    const isMilitary = flags.toLowerCase().includes("military") || flags.toLowerCase().includes("mil");
    const isInteresting = flags.toLowerCase().includes("interesting");

    return isMilitary || isInteresting;
  })
  .map((plane) => plane.flight!.trim());
```

## Expected Results

### Before Optimization

- 345 calls in a few hours
- Estimated daily: ~2,000-2,500 calls
- Monthly cost: ~$375 (75x over budget!)

### After Optimization

- 24-hour cache: 75% reduction → ~500-625 calls/day
- Selective fetching: 85% reduction on remaining → **~75-95 calls/day**
- Daily limit: Hard cap at 500 calls/day
- **Monthly estimate: ~2,250-2,850 calls = $11.25-$14.25**
- ✅ Well within $25/month free tier

## Deployment

Changes made to:

1. `functions/src/services/flight-data-cache.ts`

   - Increased CACHE_TTL_MS to 24 hours
   - Added DAILY_CALL_LIMIT constant (500)
   - Added `canMakeApiCall()` function with Firestore transaction
   - Added daily stats tracking in `aeroapi-stats` collection

2. `functions/src/aircraft-collection.ts`
   - Added filtering logic to only fetch military/interesting aircraft
   - Enhanced logging to show filtered aircraft count

**To deploy:**

```bash
npm run deploy:functions
```

## Monitoring

### Check Daily Usage

Navigate to Firestore → `aeroapi-stats` collection:

- Document ID = date (YYYY-MM-DD)
- `calls` field = total API calls that day

### Check AeroAPI Dashboard

https://flightaware.com/aeroapi/portal/usage

- View actual costs and call counts
- Verify optimization is working

### Logs

Check Cloud Functions logs for:

- "Daily AeroAPI call limit reached" → hitting the 500/day cap
- "Processing aircraft for flight data" → see `callsignsFound` count (should be much lower)

## Future Optimizations (if needed)

1. **Reduce collection frequency** (currently every 60 seconds)

   - Change to 2-3 minutes for non-critical updates
   - Further reduces API calls by 50-66%

2. **Global flight cache** (shared across locations)

   - Same flight seen by multiple users = only 1 API call
   - Requires architectural change

3. **Adjust daily limit**

   - Increase if needed (e.g., to 1,000)
   - Decrease for even more savings (e.g., to 250)

4. **Add user preference**
   - Let users enable/disable route data per device
   - Premium users could get route data for all aircraft

## Rollback Plan

If these changes cause issues:

1. Revert cache TTL to 6 hours:

   ```typescript
   const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
   ```

2. Remove daily limit check (allow unlimited calls):

   - Comment out the `canMakeApiCall()` check in `getFlightData()`

3. Remove selective filtering (fetch for all aircraft):

   - Revert `aircraft-collection.ts` to filter only by `plane.flight && plane.flight.trim()`

4. Redeploy functions:
   ```bash
   npm run deploy:functions
   ```
