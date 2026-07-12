#!/usr/bin/env node
/**
 * Visible browser check — opens Chrome on your machine, logs into planes.dryl.io,
 * expands right-nav controls, clicks Military History, keeps window open.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveDrylCredentials } from '../../directory/scripts/lib/dryl-credentials.mjs';
import { ensureLoggedIn } from '../../directory/scripts/lib/smoke-spa-session.mjs';
import { gotoDrylSpa } from '../../directory/scripts/lib/smoke-spa-goto.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reposRoot = join(__dirname, '..', '..');
const pwRoot = join(reposRoot, 'directory', 'node_modules', 'playwright-core');
const { chromium } = await import(pathToFileURL(join(pwRoot, 'index.mjs')).href);

const creds = resolveDrylCredentials(reposRoot);
const url = 'https://planes.dryl.io';

const launchOptions = { headless: false, slowMo: 250 };
for (const channel of ['chrome']) {
  try {
    const browser = await chromium.launch({ ...launchOptions, channel });
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();

    console.log(`[browser] opened ${channel} — loading ${url}`);
    await ensureLoggedIn(context, creds, url, { required: true });
    await gotoDrylSpa(page, context, { creds, publicUrl: url, loginRequired: true });
    await page.waitForTimeout(5000);

    const bundle = await page.evaluate(() =>
      [...document.querySelectorAll('script[src]')]
        .map((el) => el.src)
        .find((src) => /main-[A-Z0-9]+\.js/i.test(src))
        ?.split('/')
        .pop(),
    );
    console.log(`[browser] bundle: ${bundle ?? 'MISSING'}`);

    const expand = page.locator('app-tab[side="right"] .toggle-other-controls');
    if (await expand.count()) {
      const label = await expand.first().getAttribute('aria-label');
      if (label?.toLowerCase().includes('show controls')) {
        console.log('[browser] expanding right-nav controls…');
        await expand.first().click();
        await page.waitForTimeout(800);
      }
    }

    const historyBtn = page.locator('app-button.military-history');
    const count = await historyBtn.count();
    console.log(`[browser] military-history buttons found: ${count}`);

    if (count === 0) {
      console.error('[fail] No history button in right nav — check bundle and controls strip');
      console.log('[browser] leaving window open 90s for inspection…');
      await page.waitForTimeout(90_000);
      await browser.close();
      process.exit(1);
    }

    console.log('[browser] clicking Military History…');
    await historyBtn.first().click();
    await page.waitForTimeout(1500);

    const panel = await page.locator('app-military-history-panel').count();
    const title = await page.locator('text=Military Aircraft History').count();
    console.log(`[browser] panel open: ${panel > 0}, title visible: ${title > 0}`);

    if (panel === 0) {
      console.error('[fail] History panel did not open');
      await page.waitForTimeout(90_000);
      await browser.close();
      process.exit(1);
    }

    console.log('[ok] History tab and panel verified in visible browser.');
    console.log('[browser] window stays open 90s — inspect the right nav and panel yourself.');
    await page.waitForTimeout(90_000);
    await browser.close();
    process.exit(0);
  } catch (err) {
    if (channel === 'chrome') {
      console.error('[fail]', err instanceof Error ? err.message : err);
      process.exit(1);
    }
    console.warn(`[warn] ${channel} unavailable, trying chrome…`);
  }
}