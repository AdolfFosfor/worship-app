import { initData, retrieveRawInitData, themeParams, useSignal } from '@tma.js/sdk-vue'
import { stripLaunchParamsQuery } from '~/utils/telegram/readLaunchTheme'

/**
 * Telegram Mini App helpers.
 * Outside Telegram the client plugin applies a mock env with stub initData.
 */
export function useTelegramApp() {
  const isMocked = useState('telegram-mocked', () => false)
  const user = useSignal(initData.user)
  const isDark = useSignal(themeParams.isDark)

  return {
    /** True when running in a real Telegram client (not the local browser mock). */
    isTelegramEnvironment: computed(() => import.meta.client && !isMocked.value),
    isMocked,
    isDark,
    user,
    /**
     * Prefer `tgWebAppData` from the launch URL — Telegram refreshes it on open,
     * while `retrieveRawInitData()` / sessionStorage can stay stale for a day+.
     */
    getInitDataRaw: () => {
      if (!import.meta.client) return undefined
      try {
        const fromUrl = new URLSearchParams(
          stripLaunchParamsQuery(window.location.href),
        ).get('tgWebAppData')
        if (fromUrl?.trim()) return fromUrl.trim()
      } catch {
        // ignore
      }
      try {
        return retrieveRawInitData() || undefined
      } catch {
        // Outside Telegram / before mock launch params are available
        return undefined
      }
    },
  }
}
