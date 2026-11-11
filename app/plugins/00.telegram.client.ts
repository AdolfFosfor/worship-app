import { init, initData } from '@tma.js/sdk-vue'
import { applyTelegramDevMock } from '~/utils/telegram/devMock'
import { applyTelegramTheme } from '~/utils/telegram/applyTheme'
import { lockPortraitOrientation } from '~/utils/telegram/lockPortraitOrientation'
import { hasUrlLaunchParams } from '~/utils/telegram/readLaunchTheme'

/**
 * Real Telegram clients expose a webview proxy (native), iframe (Web),
 * or classic `Telegram.WebApp` injected by telegram-web-app.js / client.
 * `isTMA()` alone is not enough: leftover `tapps/launchParams` in sessionStorage makes it
 * return true in a regular browser, then `init()` throws UnknownEnvError (no postEvent transport).
 */
function hasTelegramTransport(): boolean {
  const win = window as Window & {
    TelegramWebviewProxy?: { postEvent?: unknown }
    Telegram?: { WebApp?: { initData?: string; postEvent?: unknown } }
  }
  if (typeof win.TelegramWebviewProxy?.postEvent === 'function') return true
  if (window.parent !== window) return true
  const webApp = win.Telegram?.WebApp
  if (webApp && (webApp.initData || typeof webApp.postEvent === 'function')) return true
  return false
}

export default defineNuxtPlugin(() => {
  const isMocked = useState('telegram-mocked', () => false)
  let disposeMock: (() => void) | undefined

  const urlLaunch = hasUrlLaunchParams()

  // Stale browser mock in sessionStorage must not beat real Telegram params from the URL.
  if (urlLaunch) {
    try {
      sessionStorage.removeItem('tapps/launchParams')
    } catch {
      // ignore
    }
  }

  if (!hasTelegramTransport()) {
    disposeMock = applyTelegramDevMock({ transportOnly: urlLaunch })
    // Real launch params from Telegram → not a dev stub session.
    isMocked.value = !urlLaunch
  }

  try {
    init()
    initData.restore()
  } catch (e) {
    // Не валим boot: UnknownEnvError / битый launchParams оставляли вечный splash в TMA.
    console.warn('[telegram] init failed', e)
  }

  const disposeTheme = applyTelegramTheme()
  const unlockOrientation = lockPortraitOrientation()

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      unlockOrientation()
      disposeTheme()
      disposeMock?.()
    })
  }
})
