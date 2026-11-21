package motion

const ProbeJS = `
(async () => {
  const markers = [...document.querySelectorAll('.plane-marker')].slice(0, 24);
  const snap = () => markers.map((el) => {
    const c = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      cls: el.className?.toString() || '',
      x: +r.x.toFixed(2),
      y: +r.y.toFixed(2),
      transform: c.transform,
      animation: c.animationName,
      duration: c.animationDuration,
      transition: c.transitionDuration,
    };
  });
  const before = snap();
  await new Promise((r) => setTimeout(r, 2500));
  const after = snap();
  const moved = before.filter((b, i) => {
    const a = after[i];
    if (!a) return false;
    return Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5 || a.transform !== b.transform;
  }).length;
  const running = document.getAnimations().filter((a) => a.playState === 'running');
  const timedTransitions = markers.filter((el) => {
    const d = getComputedStyle(el).transitionDuration;
    return d && d !== '0s' && !d.split(',').every((p) => p.trim() === '0s');
  }).length;
  const rainKids = document.querySelectorAll('app-rain-overlay .rain-drop, app-rain-overlay [class*="drop"]').length;
  const swallowKids = document.querySelectorAll('app-swallow-animation app-swallow-bird, app-swallow-animation .swallow').length;
  const leafKids = document.querySelectorAll('app-fall-leaves-animation app-fall-leaf, app-fall-leaves-animation .leaf').length;
  return {
    url: location.href,
    storedAnimations: localStorage.getItem('animationsEnabled'),
    bodyClass: document.body.className,
    runningCount: running.length,
    running: running.slice(0, 12).map((a) => ({
      playState: a.playState,
      currentTime: a.currentTime,
      target: a.effect?.target?.className?.toString() || '',
    })),
    timedTransitions,
    movedMarkers: moved,
    decorative: { rainKids, swallowKids, leafKids },
    seenCollapsed: document.querySelector('#seenResults')?.classList.contains('collapsed') ?? false,
    skyRows: document.querySelectorAll('app-results-sky-list app-plane-list-item').length,
    seenRows: document.querySelectorAll('app-results-seen-list app-plane-list-item').length,
    markerSample: before.slice(0, 4),
  };
})()
`
