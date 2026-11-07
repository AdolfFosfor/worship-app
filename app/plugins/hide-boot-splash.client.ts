/**
 * Hides the pre-Nuxt boot splash once the Vue app has mounted and painted.
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
  nuxtApp.hook('app:mounted', () => {
    // Let the first frame of the app paint, then fade the splash out.
    requestAnimationFrame(() => {
      requestAnimationFrame(dismissBootSplash)
    })
  })
})
