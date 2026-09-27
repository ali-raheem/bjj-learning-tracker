import { expect, test } from '@playwright/test';

test('serves a valid manifest and registers a service worker', async ({ page }) => {
  await page.goto('/#/');
  const manifest = await page.evaluate(async () => {
    const res = await fetch('/bjj/manifest.webmanifest');
    return { ok: res.ok, body: await res.json() };
  });
  expect(manifest.ok).toBe(true);
  // A fixed id keeps the installed app's identity independent of start_url, so changing
  // start_url later (e.g. moving off /bjj/) updates existing installs rather than duplicating them.
  expect(manifest.body.id).toBe('/bjj/');
  expect(manifest.body.start_url).toBe('/bjj/');

  const registration = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    return { scope: r.scope, hasActive: !!r.active };
  });
  expect(registration.scope).toBe('http://localhost:4173/bjj/');
  expect(registration.hasActive).toBe(true);
});

test('the app shell still works offline once cached', async ({ page, context }) => {
  await page.goto('/#/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(500); // let the SW finish precaching

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('main')).toBeVisible();
  await context.setOffline(false);
});
