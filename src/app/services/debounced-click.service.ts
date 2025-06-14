import { Injectable } from '@angular/core';

interface ClickHandler {
  handler: () => void;
  timeout?: number;
}

@Injectable({
  providedIn: 'root'
})
export class DebouncedClickService {
  private pendingClicks = new Map<string, ClickHandler>();
  private readonly DEFAULT_DEBOUNCE_DELAY = 150; // 150ms debounce

  constructor() {}

  /**
   * Execute a click handler with debouncing to prevent rapid successive clicks
   * @param key Unique identifier for the click action
   * @param handler Function to execute
   * @param delay Debounce delay in milliseconds (default: 150ms)
   */
  debouncedClick(key: string, handler: () => void, delay: number = this.DEFAULT_DEBOUNCE_DELAY): void {
    // Clear any existing timeout for this key
    const existing = this.pendingClicks.get(key);
    if (existing?.timeout) {
      clearTimeout(existing.timeout);
    }

    // Set up new debounced execution
    const timeout = window.setTimeout(() => {
      this.pendingClicks.delete(key);
      handler();
    }, delay);

    this.pendingClicks.set(key, {
      handler,
      timeout
    });
  }

  /**
   * Execute immediately but prevent duplicate calls for the same key
   * @param key Unique identifier for the click action
   * @param handler Function to execute
   */
  preventDuplicateClick(key: string, handler: () => void): void {
    // If there's already a pending click for this key, ignore
    if (this.pendingClicks.has(key)) {
      return;
    }

    // Mark as pending and execute immediately
    this.pendingClicks.set(key, { handler });
    
    try {
      handler();
    } finally {
      // Use a short timeout to prevent immediate duplicate calls
      setTimeout(() => {
        this.pendingClicks.delete(key);
      }, 50);
    }
  }

  /**
   * Cancel a pending click by key
   */
  cancelClick(key: string): void {
    const pending = this.pendingClicks.get(key);
    if (pending?.timeout) {
      clearTimeout(pending.timeout);
    }
    this.pendingClicks.delete(key);
  }

  /**
   * Clear all pending clicks
   */
  clearAll(): void {
    for (const [key, click] of this.pendingClicks.entries()) {
      if (click.timeout) {
        clearTimeout(click.timeout);
      }
    }
    this.pendingClicks.clear();
  }
}
