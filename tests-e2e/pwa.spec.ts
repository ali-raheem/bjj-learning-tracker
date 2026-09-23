import { expect, test } from '@playwright/test';

test('serves a valid manifest and registers a service worker', async ({ page }) => {
  await page.goto('/#/');
  const manifestOk = await page.evaluate(async () => (await fetch('/bjj/manifest.webmanifest')).ok);
  expect(manifestOk).toBe(true);

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
