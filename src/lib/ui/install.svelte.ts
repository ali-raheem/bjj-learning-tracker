/**
 * Captures Chrome's `beforeinstallprompt` event so the app can offer its own Install button
 * instead of relying on the browser's menu or address-bar icon.
 *
 * The event fires once, early, and only when the browser considers the app installable and not
 * already installed, so start() runs at startup rather than when the Backup screen mounts.
 * Safari and Firefox never fire it; there `available` stays false and the button stays hidden.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

class InstallPrompt {
  available = $state(false);
  private deferred: BeforeInstallPromptEvent | null = null;
  private started = false;

  start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    window.addEventListener('beforeinstallprompt', (e) => {
      // Suppress the browser's own mini-infobar; the Backup screen offers the button instead.
      e.preventDefault();
      this.deferred = e as BeforeInstallPromptEvent;
      this.available = true;
    });
    window.addEventListener('appinstalled', () => {
      this.deferred = null;
      this.available = false;
    });
  }

  async install() {
    const e = this.deferred;
    if (!e) return;
    // A captured event can only be prompted once, whatever the user picks.
    this.deferred = null;
    this.available = false;
    await e.prompt();
    await e.userChoice;
  }
}

export const installPrompt = new InstallPrompt();
