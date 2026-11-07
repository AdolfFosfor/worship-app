import { postEvent, retrieveLaunchParams, supports } from '@tma.js/sdk-vue'

function isPortrait(): boolean {
  if (typeof window === 'undefined') {
    return true
  }
  if (window.matchMedia('(orientation: portrait)').matches) {
    return true
  }
  return window.innerHeight >= window.innerWidth
}

function lockViaTelegram(): boolean {
  try {
    const { tgWebAppVersion } = retrieveLaunchParams()
    if (!supports('web_app_toggle_orientation_lock', tgWebAppVersion)) {
      return false
    }
    postEvent('web_app_toggle_orientation_lock', { locked: true })
    return true
  } catch {
    return false
  }
}

function lockViaScreenApi(): void {
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: OrientationLockType) => Promise<void>
    }
    void orientation.lock?.('portrait').catch(() => {
      // Нужен fullscreen / PWA — в обычном WebView часто недоступно.
    })
  } catch {
    // ignore
  }
}

/**
 * Фиксирует портретную ориентацию в Telegram (Bot API 8+) и по возможности через Screen Orientation API.
 * `lockOrientation` фиксирует текущий режим — вызываем только в portrait.
 */
export function lockPortraitOrientation(): () => void {
  let locked = false
  let disposed = false

  const tryLock = () => {
    if (disposed || locked || !isPortrait()) {
      return
    }
    const viaTg = lockViaTelegram()
    lockViaScreenApi()
    locked = viaTg
  }

  tryLock()

  const onOrient = () => {
    window.setTimeout(tryLock, 120)
  }

  window.addEventListener('orientationchange', onOrient)
  window.visualViewport?.addEventListener('resize', onOrient)

  return () => {
    disposed = true
    window.removeEventListener('orientationchange', onOrient)
    window.visualViewport?.removeEventListener('resize', onOrient)
    if (!locked) {
      return
    }
    try {
      const { tgWebAppVersion } = retrieveLaunchParams()
      if (supports('web_app_toggle_orientation_lock', tgWebAppVersion)) {
        postEvent('web_app_toggle_orientation_lock', { locked: false })
      }
    } catch {
      // ignore
    }
  }
}
