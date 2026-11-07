import type { ThemeParamsType } from '@tma.js/sdk-vue'

/** Strip URL to launch-params query — same idea as @tma.js/bridge. */
export function stripLaunchParamsQuery(url: string): string {
  return String(url).replace(/^[^?#]*[?#]/, '').replace(/[?#]/g, '&')
}

/** True when Telegram (or a hash preview) passed launch params in the URL. */
export function hasUrlLaunchParams(): boolean {
  try {
    const params = new URLSearchParams(stripLaunchParamsQuery(window.location.href))
    return (
      params.has('tgWebAppPlatform') ||
      params.has('tgWebAppData') ||
      params.has('tgWebAppThemeParams')
    )
  } catch {
    return false
  }
}

/**
 * Reads `tgWebAppThemeParams` JSON from the current URL (hash or query).
 * Used for early paint and to avoid overwriting a real Telegram theme with the dev mock.
 */
export function readTelegramThemeFromLocation(): ThemeParamsType | null {
  try {
    const encoded = new URLSearchParams(
      stripLaunchParamsQuery(window.location.href),
    ).get('tgWebAppThemeParams')
    if (!encoded) {
      return null
    }
    const theme = JSON.parse(encoded) as ThemeParamsType
    if (!theme || typeof theme !== 'object') {
      return null
    }
    if (!theme.bg_color && !theme.secondary_bg_color) {
      return null
    }
    return theme
  } catch {
    return null
  }
}
