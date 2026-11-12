/**
 * KeepAlive: Teleport в layout иначе остаётся/пропадает при смене страницы.
 * Показываем portal-контент только пока инстанс активен.
 */
export function usePageActive() {
  const pageActive = ref(true)

  onActivated(() => {
    pageActive.value = true
  })

  onDeactivated(() => {
    pageActive.value = false
  })

  return pageActive
}
