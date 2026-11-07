import { emitEvent, mockTelegramEnv } from '@tma.js/sdk-vue'
import type { ThemeParamsType } from '@tma.js/sdk-vue'
import { readTelegramThemeFromLocation } from '~/utils/telegram/readLaunchTheme'

/** Dev-only stub user when the app runs outside Telegram. */
export const DEV_MOCK_USER = {
  id: 10001,
  first_name: 'Dev',
  last_name: 'User',
  username: 'dev_user',
  language_code: 'ru',
  is_premium: false,
  allows_write_to_pm: true,
} as const

const noInsets = { left: 0, top: 0, bottom: 0, right: 0 }

/** Light palette close to Telegram iOS / Android defaults. */
export const MOCK_THEME_LIGHT = {
  accent_text_color: '#007aff',
  bg_color: '#ffffff',
  bottom_bar_bg_color: '#ffffff',
  button_color: '#007aff',
  button_text_color: '#ffffff',
  destructive_text_color: '#ff3b30',
  header_bg_color: '#ffffff',
  hint_color: '#8e8e93',
  link_color: '#007aff',
  secondary_bg_color: '#efeff4',
  section_bg_color: '#ffffff',
  section_header_text_color: '#6d6d72',
  section_separator_color: '#c8c7cc',
  subtitle_text_color: '#8e8e93',
  text_color: '#000000',
} satisfies ThemeParamsType

/** Dark palette close to Telegram Night defaults. */
export const MOCK_THEME_DARK = {
  accent_text_color: '#6ab2f2',
  bg_color: '#17212b',
  bottom_bar_bg_color: '#17212b',
  button_color: '#5288c1',
  button_text_color: '#ffffff',
  destructive_text_color: '#ec3942',
  header_bg_color: '#17212b',
  hint_color: '#708499',
  link_color: '#6ab3f3',
  secondary_bg_color: '#0e1621',
  section_bg_color: '#17212b',
  section_header_text_color: '#6ab3f3',
  section_separator_color: '#232e3c',
  subtitle_text_color: '#708499',
  text_color: '#f5f5f5',
} satisfies ThemeParamsType

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function currentMockTheme(): ThemeParamsType {
  return prefersDark() ? MOCK_THEME_DARK : MOCK_THEME_LIGHT
}

function resolveTheme(): ThemeParamsType {
  return readTelegramThemeFromLocation() ?? currentMockTheme()
}

function createMockInitDataRaw(): string {
  return new URLSearchParams([
    ['user', JSON.stringify(DEV_MOCK_USER)],
    ['auth_date', String(Math.floor(Date.now() / 1000))],
    ['hash', 'dev_mock_hash'],
    ['signature', 'dev_mock_signature'],
  ]).toString()
}

export interface ApplyTelegramDevMockOptions {
  /**
   * Only stub postEvent transport. Keeps launch params / theme from the URL
   * (real Telegram open where WebView proxy detection failed, or hash preview).
   */
  transportOnly?: boolean
}

/**
 * Imitates Telegram Mini Apps outside the real client (browser / local preview).
 * Must be called before `init()`.
 * Follows system light/dark and re-emits `theme_changed` on preference change.
 */
export function applyTelegramDevMock(
  options: ApplyTelegramDevMockOptions = {},
): () => void {
  const { transportOnly = false } = options
  const launchTheme = resolveTheme()

  mockTelegramEnv({
    // Omitting launchParams preserves tgWebAppThemeParams from the URL / session.
    ...(transportOnly
      ? {}
      : {
          launchParams: {
            tgWebAppPlatform: 'tdesktop',
            tgWebAppVersion: '9.1',
            tgWebAppStartParam: 'dev',
            tgWebAppThemeParams: launchTheme,
            // Raw init-data query string is required for retrieveRawInitData / auth headers.
            tgWebAppData: createMockInitDataRaw(),
          },
        }),
    onEvent(event, next) {
      if (event.name === 'web_app_request_theme') {
        // Prefer URL theme so a real Telegram palette is never replaced by the stub.
        return emitEvent('theme_changed', { theme_params: resolveTheme() })
      }
      if (event.name === 'web_app_request_viewport') {
        return emitEvent('viewport_changed', {
          height: window.innerHeight,
          width: window.innerWidth,
          is_expanded: true,
          is_state_stable: true,
        })
      }
      if (event.name === 'web_app_request_content_safe_area') {
        return emitEvent('content_safe_area_changed', noInsets)
      }
      if (event.name === 'web_app_request_safe_area') {
        return emitEvent('safe_area_changed', noInsets)
      }
      next()
    },
  })

  if (transportOnly) {
    return () => undefined
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onSchemeChange = () => {
    // Don't override an explicit Telegram theme from the URL on OS scheme changes.
    if (readTelegramThemeFromLocation()) {
      return
    }
    emitEvent('theme_changed', { theme_params: currentMockTheme() })
  }

  media.addEventListener('change', onSchemeChange)

  return () => {
    media.removeEventListener('change', onSchemeChange)
  }
}
