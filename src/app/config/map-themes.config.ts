// Map themes switched from Stadia Maps (403/upgrade) to free OSM & CARTO providers
export const MAP_THEMES = {
  day: {
    // OpenStreetMap Standard tiles (respect usage policy; light theme)
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  },
  night: {
    // CARTO Dark Matter tiles (no key required)
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }
};
