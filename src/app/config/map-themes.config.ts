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
    // CARTO Dark Matter tiles for night mode
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
};
