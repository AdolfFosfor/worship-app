import { init, initData } from '@tma.js/sdk-vue'
import { applyTelegramDevMock } from '~/utils/telegram/devMock'
import { applyTelegramTheme } from '~/utils/telegram/applyTheme'
import { lockPortraitOrientation } from '~/utils/telegram/lockPortraitOrientation'
import { hasUrlLaunchParams } from '~/utils/telegram/readLaunchTheme'

/**
 * Real Telegram clients expose a webview proxy (native) or open the app in an iframe (Web).
 * `isTMA()` alone is not enough: leftover `tapps/launchParams` in sessionStorage makes it
 * return true in a regular browser, then `init()` throws UnknownEnvError (no postEvent transport).
 */
function hasTelegramTransport(): boolean {
  const win = window as Window & {
    TelegramWebviewProxy?: { postEvent?: unknown }
  }
  return (
    typeof win.TelegramWebviewProxy?.postEvent === 'function' ||
    window.parent !== window
  )
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
