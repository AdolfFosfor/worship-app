import { backButton } from '@tma.js/sdk-vue'

/**
 * Shows Telegram BackButton on nested routes and navigates back on click.
 * Optional `fallbackTo` prefers an explicit in-app path (e.g. return to setlist).
 */
export function useTelegramBackButton(
  enabled: MaybeRefOrGetter<boolean> = true,
  fallbackTo?: MaybeRefOrGetter<string | undefined>,
) {
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

  function goBack() {
    const { markPopNavigation } = useNavigationDirection()
    markPopNavigation()

    const to = toValue(fallbackTo)
    if (to) {
      void navigateTo(to)
      return
    }
    if (window.history.length > 1) {
      router.back()
      return
    }
    void navigateTo('/')
  }

  onMounted(() => {
    sync()
    try {
      if (backButton.isSupported()) {
        backButton.onClick(goBack)
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
