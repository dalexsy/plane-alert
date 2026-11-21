package probe

const ProbeJS = `
(async () => {
  const longTasks = [];
  try {
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        longTasks.push(Math.round(e.duration));
      }
    });
    po.observe({ type: 'longtask', buffered: true });
  } catch {}

  await new Promise((r) => setTimeout(r, 3000));

  let blurOnKeyNodes = 0;
  document.querySelectorAll('.leaflet-tooltip, .plane-label.has-details').forEach((el) => {
    const cs = getComputedStyle(el);
    const f = cs.backdropFilter || cs.webkitBackdropFilter;
    if (f && f !== 'none') blurOnKeyNodes++;
  });
  let planeDropShadowCount = 0;
  document.querySelectorAll('.plane-marker').forEach((el) => {
    const f = getComputedStyle(el).filter;
    if (f && f !== 'none') planeDropShadowCount++;
  });
  const sample = document.querySelector('.leaflet-tooltip.plane-tooltip');
  let sampleStyle = null;
  if (sample) {
    const cs = getComputedStyle(sample);
    sampleStyle = {
      padding: cs.padding,
      lineHeight: cs.lineHeight,
      fontSize: cs.fontSize,
      borderTopWidth: cs.borderTopWidth,
      backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter,
      height: Math.round(sample.getBoundingClientRect().height),
    };
  }
  const running = document.getAnimations().filter((a) => a.playState === 'running');
  return {
    url: location.href,
    body: document.body.className,
    animationsEnabled: localStorage.getItem('animationsEnabled'),
    showWindowView: localStorage.getItem('showWindowView'),
    markers: document.querySelectorAll('.plane-marker-container').length,
    tooltips: document.querySelectorAll('.leaflet-tooltip').length,
    permanentVisible: [...document.querySelectorAll('.leaflet-tooltip')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).length,
    leftTooltips: document.querySelectorAll('.leaflet-tooltip.leaflet-tooltip-left').length,
    blurOnKeyNodes,
    planeDropShadowCount,
    runningAnims: running.length,
    rainKids: document.querySelectorAll('app-rain-overlay .rain-drop').length,
    swallowKids: document.querySelectorAll('app-swallow-animation app-swallow-bird, app-swallow-animation .swallow').length,
    leafKids: document.querySelectorAll('app-fall-leaves-animation app-fall-leaf, app-fall-leaves-animation .leaf').length,
    longTaskCount: longTasks.length,
    longTaskMaxMs: longTasks.length ? Math.max(...longTasks) : 0,
    sampleStyle,
    domNodes: document.getElementsByTagName('*').length,
  };
})()
`
