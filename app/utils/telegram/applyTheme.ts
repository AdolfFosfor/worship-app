import {
  miniApp,
  retrieveLaunchParams,
  themeParams,
  viewport,
} from '@tma.js/sdk-vue'

function syncDarkClass(isDark: boolean) {
  document.documentElement.classList.toggle('app-dark', isDark)
}

function syncFullscreenClass(isFullscreen: boolean) {
  document.documentElement.classList.toggle('app-fullscreen', isFullscreen)
}

function isMobileTelegramPlatform(): boolean {
  try {
    const { tgWebAppPlatform } = retrieveLaunchParams()
    const platform = String(tgWebAppPlatform || '').toLowerCase()
    return platform === 'ios' || platform.startsWith('android')
  } catch {
    return false
  }
}

function applyChromeColors() {
  try {
    if (miniApp.setHeaderColor.isAvailable()) {
      // В fullscreen Telegram использует header color для контраста status bar.
      miniApp.setHeaderColor('bg_color')
    }
  } catch {
    // ignore
  }
  try {
    if (miniApp.setBgColor.isAvailable()) {
      miniApp.setBgColor('bg_color')
    }
  } catch {
    // ignore
  }
  try {
    if (miniApp.setBottomBarColor.isAvailable()) {
      miniApp.setBottomBarColor('bg_color')
    }
  } catch {
    // ignore
  }
}

async function enterMobileFullscreen() {
  if (!isMobileTelegramPlatform()) {
    return
  }
  try {
    if (!viewport.requestFullscreen.isSupported()) {
      return
    }
    if (!viewport.requestFullscreen.isAvailable()) {
      return
    }
    await viewport.requestFullscreen()
  } catch {
    // Старые клиенты / отказ пользователя / desktop WebView.
  }
}

/**
 * Mount Telegram theme params, bind CSS vars, sync `.app-dark`,
 * expand + fullscreen viewport on mobile.
 * Fullscreen: `--tg-viewport-*-safe-area-inset-*` drive `--app-safe-*` paddings.
 */
export function applyTelegramTheme(): () => void {
  try {
    themeParams.mount()
  } catch {
    // Theme params unavailable — keep CSS fallbacks.
    return () => undefined
  }

  let unbindCssVars: (() => void) | undefined
  try {
    unbindCssVars = themeParams.bindCssVars()
  } catch {
    unbindCssVars = undefined
  }

  syncDarkClass(themeParams.isDark())
  const offDark = themeParams.isDark.sub(syncDarkClass)

  try {
    miniApp.mount()
    miniApp.ready()
    applyChromeColors()
  } catch {
    // miniApp unavailable outside capable clients — ignore.
  }

  let unbindViewportCss: (() => void) | undefined
  let offFullscreen: (() => void) | undefined
  void (async () => {
    try {
      await viewport.mount()
      viewport.expand()
      try {
        unbindViewportCss = viewport.bindCssVars()
      } catch {
        unbindViewportCss = undefined
      }

      try {
        syncFullscreenClass(viewport.isFullscreen())
        offFullscreen = viewport.isFullscreen.sub(syncFullscreenClass)
      } catch {
        offFullscreen = undefined
      }

      await enterMobileFullscreen()
      // После fullscreen клиент может обновить insets асинхронно —
      // bindCssVars уже слушает safe_area / content_safe_area.
      applyChromeColors()
    } catch {
      // Viewport APIs optional in mock / older clients.
    }
  })()

  return () => {
    offDark()
    offFullscreen?.()
    unbindCssVars?.()
    unbindViewportCss?.()
    document.documentElement.classList.remove('app-fullscreen')
    const safeUnmount = (api: unknown) => {
      const maybe = api as { unmount?: () => void }
      try {
        maybe.unmount?.()
      } catch {
        // already unmounted / unsupported
      }
    }
    safeUnmount(themeParams)
    safeUnmount(viewport)
    safeUnmount(miniApp)
  }
}
