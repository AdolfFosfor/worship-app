import { initData, retrieveRawInitData, themeParams, useSignal } from '@tma.js/sdk-vue'

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
    getInitDataRaw: () => {
      if (!import.meta.client) return undefined
      try {
        return retrieveRawInitData() || undefined
      } catch {
        // Outside Telegram / before mock launch params are available
        return undefined
      }
    },
  }
}
