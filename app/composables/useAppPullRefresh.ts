type PullRefreshHandler = () => void | Promise<void>

const handlers = new Set<PullRefreshHandler>()

/**
 * Страница регистрирует тихий refetch для pull-to-refresh.
 * KeepAlive: активна только на экране (activated/deactivated).
 */
export function useAppPullRefresh(handler: PullRefreshHandler) {
  onMounted(() => {
    handlers.add(handler)
  })
  onBeforeUnmount(() => {
    handlers.delete(handler)
  })
  onActivated(() => {
    handlers.add(handler)
  })
  onDeactivated(() => {
    handlers.delete(handler)
  })
}

/** Мягкий PTR: без reloadNuxtApp — только refetch текущих экранов. */
export async function runAppPullRefresh() {
  const list = [...handlers]
  if (!list.length) {
    // Нет активной страницы с хендлером — хотя бы поднимем ревизии для KeepAlive
    try {
      useSetlistsRevision().bumpSetlistsRevision()
    } catch {
      // ignore
    }
    try {
      useSongsRevision().bumpSongsRevision()
    } catch {
      // ignore
    }
    try {
      useRepertoirePulseRevision().bumpRepertoirePulseRevision()
    } catch {
      // ignore
    }
    return
  }
  await Promise.allSettled(list.map((handler) => Promise.resolve(handler())))
}
