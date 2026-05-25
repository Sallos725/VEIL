import { setSidecarHttpFetch } from "./sidecar-client.js";

/**
 * Use Risu host fetch so plugin sandbox CSP (connect-src 'none') does not block sidecar.
 * @param {import('./risu-types.js').RisuaiPluginApi | undefined} Risuai
 * @returns {boolean}
 */
export function configureVeilHttpForRisu(Risuai) {
  if (Risuai && typeof Risuai.nativeFetch === "function") {
    setSidecarHttpFetch((url, options) => Risuai.nativeFetch(url, options));
    return true;
  }
  return false;
}
