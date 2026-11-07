import { miniApp, themeParams, viewport } from '@tma.js/sdk-vue'

function syncDarkClass(isDark: boolean) {
  document.documentElement.classList.toggle('app-dark', isDark)
}

function syncFullscreenClass(isFullscreen: boolean) {
  document.documentElement.classList.toggle('app-fullscreen', isFullscreen)
}

/**
 * Mount Telegram theme params, bind CSS vars, sync `.app-dark`,
 * and optionally ready/expand the Mini App viewport.
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
