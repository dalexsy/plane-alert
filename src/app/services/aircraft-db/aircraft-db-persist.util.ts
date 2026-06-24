import { MIN_WRITE_INTERVAL } from './aircraft-db-types';

export function downloadJsonFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export function isLocalDevHost(): boolean {
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

export function postSaveDb(content: string, count: number): void {
  fetch('/save-db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, count }),
  })
    .then((response) => {
      if (response.ok) {
        console.log(`✅ Saved ${count} user aircraft to repository`);
      } else {
        console.warn('Failed to save user database to repository');
      }
    })
    .catch((error) => {
      console.warn('Could not save to repository:', error.message);
      console.log('User data is still saved in localStorage');
    });
}

export type DebounceState = { saveTimeout: ReturnType<typeof setTimeout> | null; lastFileWrite: number };

export function scheduleDebouncedSave(state: DebounceState, saveFn: () => void): void {
  const now = Date.now();
  if (state.saveTimeout) clearTimeout(state.saveTimeout);
  if (now - state.lastFileWrite >= MIN_WRITE_INTERVAL) {
    state.lastFileWrite = now;
    saveFn();
  } else {
    state.saveTimeout = setTimeout(() => {
      state.lastFileWrite = Date.now();
      saveFn();
    }, MIN_WRITE_INTERVAL - (now - state.lastFileWrite));
  }
}
