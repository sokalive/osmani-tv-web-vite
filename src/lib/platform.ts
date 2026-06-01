/**
 * Platform helpers for the Vite website (browser / PWA).
 * Android APK update UI and checks must never run here.
 */

export function isWebBrowser(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return true
}

/** True only for the native Android APK client (not this website). */
export function isAndroidApkClient(): boolean {
  return false
}
