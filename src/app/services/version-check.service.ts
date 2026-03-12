import { Injectable } from '@angular/core';

/**
 * Version check service to force cache clear on updates
 */
@Injectable({
  providedIn: 'root',
})
export class VersionCheckService {
  private readonly VERSION_KEY = 'plane-alert-app-version';
  private readonly CURRENT_VERSION = 'v3.0-client-reset';
  private readonly MIGRATION_LOCK_KEY = 'plane-alert-migration-running';

  constructor() {
    void this.checkVersion();
  }

  private async checkVersion(): Promise<void> {
    const storedVersion = localStorage.getItem(this.VERSION_KEY);

    if (storedVersion !== this.CURRENT_VERSION) {
      console.log(
        `🔄 Version changed from ${storedVersion || 'unknown'} to ${this.CURRENT_VERSION}`,
      );
      console.log('🧹 Running one-time client reset migration...');

      const migrationAlreadyRunning =
        localStorage.getItem(this.MIGRATION_LOCK_KEY) === '1';

      if (!migrationAlreadyRunning) {
        localStorage.setItem(this.MIGRATION_LOCK_KEY, '1');
        await this.runClientResetMigration();
      }

      // Update version
      localStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
      localStorage.removeItem(this.MIGRATION_LOCK_KEY);

      // Force hard reload if we had an old version
      if (storedVersion) {
        console.log('💥 Forcing hard reload to clear old code...');
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    }
  }

  forceUpdate(): void {
    console.log('🔄 Forcing app update...');
    localStorage.removeItem(this.VERSION_KEY);
    window.location.reload();
  }

  private async runClientResetMigration(): Promise<void> {
    await this.clearCaches();
    await this.unregisterServiceWorkers();
    await this.clearLegacyIndexedDb();
    this.pruneLegacyLocalStorage();
  }

  private async clearCaches(): Promise<void> {
    if (!('caches' in window)) {
      return;
    }

    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  }

  private async unregisterServiceWorkers(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
  }

  private async clearLegacyIndexedDb(): Promise<void> {
    if (!('indexedDB' in window)) {
      return;
    }

    try {
      const dbApi = indexedDB as IDBFactory & {
        databases?: () => Promise<Array<{ name?: string }>>;
      };

      if (typeof dbApi.databases === 'function') {
        const databases = await dbApi.databases();
        await Promise.all(
          databases
            .map((db) => db.name)
            .filter((name): name is string => !!name)
            .map(
              (name) =>
                new Promise<void>((resolve) => {
                  const req = indexedDB.deleteDatabase(name);
                  req.onsuccess = () => resolve();
                  req.onerror = () => resolve();
                  req.onblocked = () => resolve();
                }),
            ),
        );
      }
    } catch {
      // Best-effort cleanup only
    }
  }

  private pruneLegacyLocalStorage(): void {
    const keepKeys = new Set<string>([
      this.VERSION_KEY,
      this.MIGRATION_LOCK_KEY,
      'plane-alert-user-aircraft-db',
      'plane-alert-performance-mode',
      'currentLocation',
      'currentAddress',
      'homeLocation',
      'radius',
      'lastSearchRadius',
      'lastLat',
      'lastLon',
      'disable-geocoding',
    ]);

    const legacyPrefixes = ['basic-ac-db', 'aircraft-db', 'plane-alert-db'];

    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) {
        continue;
      }

      const value = localStorage.getItem(key) || '';
      const isLegacyKey = legacyPrefixes.some((prefix) =>
        key.toLowerCase().includes(prefix),
      );
      const isHugeValue = value.length > 1_000_000;

      if ((isLegacyKey || isHugeValue) && !keepKeys.has(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => localStorage.removeItem(key));
  }
}
