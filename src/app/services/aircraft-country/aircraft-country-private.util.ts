/* Extracted from aircraft-country.service.ts */
import type { AircraftCountryService } from './aircraft-country.service';

export type Ctx = AircraftCountryService;

export async function ensureRangesLoaded(ctx: Ctx) {
    if (!ctx.icaoRangesLoaded) {
      await ctx.icaoRangesPromise;
    }
}
