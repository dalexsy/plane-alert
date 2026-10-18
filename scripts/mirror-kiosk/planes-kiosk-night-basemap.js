/* Kiosk compatibility for the deployed build until its native provider change ships. */
(() => {
  if (location.hostname !== 'planes.dryl.io' || !new URL(location.href).searchParams.has('kiosk')) {
    return { provider: 'unchanged', reason: 'not-kiosk' };
  }
  if (window.__planesNightBasemap) return window.__planesNightBasemap.status();
  const pane = document.querySelector('.leaflet-tile-pane');
  if (!pane) return { provider: 'unchanged', reason: 'map-not-ready' };
  const tileUrl = source => {
    let url;
    try { url = new URL(source); } catch { return null; }
    if (!url.hostname.endsWith('.basemaps.cartocdn.com') && url.hostname !== 'basemaps.cartocdn.com') return null;
    const [style, z, x, filename] = url.pathname.split('/').filter(Boolean);
    const y = filename?.replace(/(?:@2x)?\.png$/, '');
    if (style !== 'dark_all' || ![z, x, y].every(value => /^\d+$/.test(value || ''))) return null;
    return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  };
  const originals = new WeakMap();
  let replacements = 0;
  const style = document.createElement('style');
  style.id = 'planes-night-basemap-style';
  style.textContent = '.leaflet-layer.planes-night-basemap { filter:invert(1) hue-rotate(180deg) brightness(0.65) contrast(0.9); }';
  const credit = document.createElement('a');
  credit.id = 'planes-night-basemap-credit';
  credit.href = 'https://www.openstreetmap.org/copyright';
  credit.textContent = '© OpenStreetMap contributors';
  credit.target = '_blank';
  credit.rel = 'noopener';
  credit.style.cssText = 'position:fixed;top:52px;left:8px;z-index:2147483647;background:#111;color:#ddd;font:12px system-ui;padding:3px 5px;';
  let mounted = false;
  const replace = image => {
    if (!(image instanceof HTMLImageElement)) return;
    const replacement = tileUrl(image.src);
    if (!replacement) return;
    if (!mounted) {
      document.head.append(style);
      document.body.append(credit);
      mounted = true;
    }
    image.closest('.leaflet-layer')?.classList.add('planes-night-basemap');
    if (!originals.has(image)) replacements += 1;
    originals.set(image, image.src);
    image.src = replacement;
  };
  const observer = new MutationObserver(rows => {
    for (const row of rows) {
      if (row.type === 'attributes') replace(row.target);
      for (const node of row.addedNodes) {
        replace(node);
        node.querySelectorAll?.('img').forEach(replace);
      }
    }
  });
  observer.observe(pane, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
  pane.querySelectorAll('img').forEach(replace);
  const state = {
    status: () => ({ provider: mounted ? 'OpenStreetMap' : 'native', replacements }),
    restore() {
      observer.disconnect();
      pane.querySelectorAll('img').forEach(image => {
        const source = originals.get(image);
        if (source) image.src = source;
      });
      pane.querySelectorAll('.planes-night-basemap').forEach(layer => layer.classList.remove('planes-night-basemap'));
      style.remove();
      credit.remove();
      delete window.__planesNightBasemap;
    },
  };
  window.__planesNightBasemap = state;
  return state.status();
})()
