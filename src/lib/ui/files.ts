export function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(name: string): string {
  return (
    name
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'book'
  );
}

export function pickFile(accept = 'application/json,.json'): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export function confirmAction(message: string): boolean {
  return window.confirm(message);
}

export function promptText(message: string, initial = ''): string | null {
  const v = window.prompt(message, initial);
  return v === null ? null : v;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export type ExportOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * On phones, hand the file to the share sheet (Files, Drive, mail…) which is far easier to find
 * than a download. Everywhere else, download. Must be called soon after a user gesture.
 */
export async function shareOrDownloadJson(
  value: unknown,
  filename: string,
): Promise<ExportOutcome> {
  const json = JSON.stringify(value, null, 2);
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof File !== 'undefined' && nav.share && nav.canShare) {
    const file = new File([json], filename, { type: 'application/json' });
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: filename });
        return 'shared';
      } catch (e) {
        if ((e as Error).name === 'AbortError') return 'cancelled';
        // Any other failure falls through to a plain download.
      }
    }
  }
  downloadJson(value, filename);
  return 'downloaded';
}

export function formatRelativeDays(days: number | null): string {
  if (days === null) return 'never';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
