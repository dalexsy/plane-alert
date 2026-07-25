const targets = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('No kiosk page target');

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data));
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  waiter(message);
});

function command(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
}

async function evaluate(label, expression) {
  const response = await command('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log(`---${label}---`);
  console.log(JSON.stringify(response.result?.result?.value ?? response, null, 2));
}

await evaluate('PAGE', `({
  url: location.href,
  title: document.title,
  online: navigator.onLine,
  visibility: document.visibilityState,
  controlled: !!navigator.serviceWorker.controller,
  text: document.body.innerText.slice(0, 1500)
})`);
await evaluate('STORAGE', `Object.fromEntries(
  Object.keys(localStorage)
    .filter((key) => /radius|filter|interval|exclude|location|lat|lon/i.test(key))
    .map((key) => [key, localStorage.getItem(key)])
)`);
await evaluate('RESOURCES', `performance.getEntriesByType('resource')
  .filter((entry) => /adsbPointProxy|api\\/planes/.test(entry.name))
  .slice(-15)
  .map((entry) => ({name: entry.name, start: entry.startTime, duration: entry.duration, size: entry.transferSize}))`);
await evaluate('LIVE_FETCH', `fetch('/api/planes/adsbPointProxy?lat=52.4605886&lon=13.523268&radiusKm=100', {cache:'no-store'})
  .then(async (response) => ({status: response.status, text: (await response.text()).slice(0, 200)}))
  .catch((error) => ({error: String(error)}))`);
ws.close();
