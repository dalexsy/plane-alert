// Map themes with satellite imagery for better visibility
export const MAP_THEMES = {
  day: {
    // Esri World Imagery (satellite) - free usage up to reasonable limits
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics'
  },
  night: {
    // CARTO Dark Matter tiles for night mode
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }
};
