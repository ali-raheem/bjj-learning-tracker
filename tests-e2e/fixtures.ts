import type { Page } from '@playwright/test';

/** A minimal, valid Book file, built in-memory so import tests don't depend on other fixtures. */
export function sampleBookJson() {
  return JSON.stringify({
    schemaVersion: 1,
    type: 'book',
    book: {
      externalId: 'e2e-sample',
      name: 'E2E Sample Book',
      version: '1.0',
      chapters: [
        {
          externalId: 'closed-guard',
          name: 'Closed Guard',
          techniques: [
            { externalId: 'flower-sweep', name: 'Flower Sweep' },
            { externalId: 'scissor-sweep', name: 'Scissor Sweep' },
            { externalId: 'armbar', name: 'Armbar' },
          ],
        },
        {
          externalId: 'half-guard',
          name: 'Half Guard',
          techniques: [{ externalId: 'knee-shield', name: 'Knee Shield Recovery' }],
        },
      ],
    },
  });
}

/** An updated version of sampleBookJson: renames one technique, drops one, adds one. */
export function sampleBookJsonV2() {
  const v1 = JSON.parse(sampleBookJson());
  v1.book.version = '1.1';
  v1.book.chapters[0].techniques[0].name = 'Flower / Pendulum Sweep';
  v1.book.chapters[0].techniques.splice(1, 1); // drop scissor sweep
  v1.book.chapters[0].techniques.push({ externalId: 'triangle', name: 'Triangle' });
  return JSON.stringify(v1);
}

export function sampleBookText() {
  return `book: E2E Text Book
id: e2e-text

# Closed guard
Flower sweep
Scissor sweep

# Half guard
Knee shield recovery
`;
}

/** Upload in-memory content via the app's file picker, which opens on a plain button click. */
export async function pickInMemoryFile(
  page: Page,
  triggerText: string,
  name: string,
  content: string,
  mimeType = 'text/plain',
) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByText(triggerText, { exact: false }).click(),
  ]);
  await chooser.setFiles({ name, mimeType, buffer: Buffer.from(content) });
}

/** Accept every confirm()/alert() dialog for the rest of this test. */
export function autoAcceptDialogs(page: Page) {
  page.on('dialog', (d) => d.accept());
}

/**
 * The filter panel's selects are each wrapped in a <label> alongside a <span> caption; the
 * label's full accessible name also picks up every <option>'s text (e.g. "Drilled" collides
 * with the Practised select's "Drilled or sparred" option and the Sort select's "Drilled
 * first"), so getByLabel is unreliable here. Scope by the caption <span> instead.
 */
export function filterSelect(page: Page, caption: string) {
  return page
    .locator('label.field')
    .filter({ has: page.locator('span', { hasText: caption, exact: true }) })
    .locator('select');
}
