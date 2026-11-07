/**
 * Фиксирует высоту shell по «полной» высоте окна и не уменьшает её при клавиатуре.
 * Иначе WebView (adjustResize) сжимает layout и bottom nav всплывает над клавиатурой.
 * Без hide/show меню — нет задержки появления.
 */

export default defineNuxtPlugin(() => {
  const root = document.documentElement

  const measure = () =>
    Math.round(Math.max(window.innerHeight, window.visualViewport?.height ?? 0))

  let locked = measure()

  const apply = () => {
    root.style.setProperty('--app-frame-height', `${locked}px`)
  }

  apply()

  const growOnly = () => {
    const next = measure()
    if (next > locked + 2) {
      locked = next
      apply()
    }
  }

  const resetAfterRotate = () => {
    window.setTimeout(() => {
      locked = measure()
      apply()
    }, 280)
  }

  window.visualViewport?.addEventListener('resize', growOnly)
  window.addEventListener('resize', growOnly)
  window.addEventListener('orientationchange', resetAfterRotate)
})
