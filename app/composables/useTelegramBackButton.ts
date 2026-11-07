import { backButton } from '@tma.js/sdk-vue'

/**
 * Shows Telegram BackButton on nested routes and navigates back on click.
 */
export function useTelegramBackButton(enabled: MaybeRefOrGetter<boolean> = true) {
  const router = useRouter()

  function sync() {
    if (!import.meta.client) return
    try {
      if (!backButton.isSupported()) return
      if (toValue(enabled)) {
        backButton.show()
      } else {
        backButton.hide()
      }
    } catch {
      // outside TMA
    }
  }

  onMounted(() => {
    sync()
    try {
      if (backButton.isSupported()) {
        backButton.onClick(() => {
          router.back()
        })
      }
    } catch {
      // ignore
    }
  })

  watch(() => toValue(enabled), sync)

  onBeforeUnmount(() => {
    try {
      if (backButton.isSupported()) backButton.hide()
    } catch {
      // ignore
    }
  })
}
