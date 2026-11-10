/**
 * Dev-only: Option/Alt + T → /dev/ui
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.dev) return

  const router = useRouter()

  function onKeydown(event: KeyboardEvent) {
    if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return
    if (event.code !== 'KeyT' && event.key.toLowerCase() !== 't') return

    const target = event.target
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT')
    ) {
      return
    }

    event.preventDefault()
    if (router.currentRoute.value.path === '/dev/ui') return
    void router.push('/dev/ui')
  }

  window.addEventListener('keydown', onKeydown)
})
