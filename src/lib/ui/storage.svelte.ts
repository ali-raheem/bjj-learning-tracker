/**
 * Requests persistent storage so the browser is less likely to silently evict this origin's
 * IndexedDB under disk pressure, which would delete everything since there is no server copy.
 *
 * Feature-detected: Safari does not implement the Storage API's persist(), but it exempts an
 * installed (Add to Home Screen) PWA from its own 7-day eviction policy anyway, so there is
 * nothing useful to request there. Chrome grants persistence silently based on heuristics like
 * site engagement and whether the app is installed; Firefox prompts the user.
 */
class PersistentStorage {
  supported = $state(false);
  /** true/false once checked; null while unchecked or on an unsupported browser. */
  persisted = $state<boolean | null>(null);
  private started = false;

  async start() {
    if (this.started) return;
    this.started = true;
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
    this.supported = true;
    try {
      this.persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist());
    } catch {
      // Some contexts (e.g. private browsing in certain browsers) can throw here.
      this.supported = false;
      this.persisted = null;
    }
  }
}

export const persistentStorage = new PersistentStorage();
