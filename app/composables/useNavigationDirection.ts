/**
 * Отличает history.back / edge-swipe (popstate) от обычного перехода.
 * На pop не делаем silent-refresh — иначе «дёргается» кэшированная страница.
 */

const POP_FLAG = 'app-nav-is-pop'
const INSTALLED = 'app-nav-pop-listener'

export function useNavigationDirection() {
  const isPopNavigation = useState(POP_FLAG, () => false)

  if (import.meta.client) {
    const installed = useState(INSTALLED, () => false)
    if (!installed.value) {
      installed.value = true
      window.addEventListener('popstate', () => {
        isPopNavigation.value = true
      })
    }
  }

  function markPopNavigation() {
    isPopNavigation.value = true
  }

  /** true, если текущая активация страницы — возврат назад. Флаг сбрасывается. */
  function consumePopNavigation(): boolean {
    if (!isPopNavigation.value) {
      return false
    }
    isPopNavigation.value = false
    return true
  }

  return {
    isPopNavigation: readonly(isPopNavigation),
    markPopNavigation,
    consumePopNavigation,
  }
}
