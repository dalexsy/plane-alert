import { rasterProviders } from '@dryl/maps';

// Domain-specific layer grouping; provider configuration is fleet-owned.
export const MAP_THEMES = {
  day: {
    // Esri World Imagery + Places labels only (cleaner, no road clutter)
    imagery: {
      url: rasterProviders.esriImagery.url,
      attribution: rasterProviders.esriImagery.attribution,
    },
    labels: {
      url: rasterProviders.esriLabels.url,
      attribution: rasterProviders.esriLabels.attribution,
    },
  },
  night: {
    imagery: {
      url: rasterProviders.esriDarkBase.url,
      attribution: rasterProviders.esriDarkBase.attribution,
    },
    labels: {
      url: rasterProviders.esriDarkReference.url,
      attribution: rasterProviders.esriDarkReference.attribution,
    },
  },
};
