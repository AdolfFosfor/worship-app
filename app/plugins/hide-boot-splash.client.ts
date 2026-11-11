/**
 * Hides the pre-Nuxt boot splash once the Vue app has mounted and painted.
 * Failsafe: never leave the splash up forever after a botched update/reload.
 */
function dismissBootSplash() {
  const el = document.getElementById('app-boot-splash')
  if (!el) {
    return
  }

  el.setAttribute('aria-busy', 'false')
  el.classList.add('app-boot-splash--done')

  const remove = () => {
    el.remove()
  }

  el.addEventListener('transitionend', remove, { once: true })
  window.setTimeout(remove, 400)
}

export default defineNuxtPlugin((nuxtApp) => {
  const scheduleDismiss = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(dismissBootSplash)
    })
  }

  nuxtApp.hook('app:mounted', scheduleDismiss)
  nuxtApp.hook('app:error', scheduleDismiss)

  // Если mount/error так и не пришли (битый бандл в WebView) — всё равно убрать спиннер.
  window.setTimeout(dismissBootSplash, 12_000)
})
