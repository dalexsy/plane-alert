// Map themes with satellite imagery for better visibility
export const MAP_THEMES = {
  day: {
    // Esri World Imagery + Places labels only (cleaner, no road clutter)
    imagery: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    },
    labels: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      attribution:
        '&copy; Esri, HERE, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors',
    },
  },
  night: {
    // Standard browser-cached raster tiles; the night treatment affects this layer only.
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    className: 'night-basemap',
  },
};
