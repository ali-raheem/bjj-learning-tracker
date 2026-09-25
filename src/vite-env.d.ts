/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Short commit hash at build time, e.g. "a1b2c3d" or "a1b2c3d (modified)" if the tree was dirty. */
declare const __APP_COMMIT__: string;
/** ISO 8601 committer date of that commit, or '' if unavailable. */
declare const __APP_COMMIT_DATE__: string;
