/**
 * Жёсткий grow-only lock высоты фрейма.
 * Не даём WebView/KB сжать shell — иначе nav всплывает над клавиатурой.
 */

export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  const root = document.documentElement
  let locked = 0

  const readCandidate = () => {
    const tgRaw = getComputedStyle(root).getPropertyValue('--tg-viewport-stable-height').trim()
    const fromTg = Number.parseFloat(tgRaw)
    const vv = window.visualViewport
    const vvH = vv ? Math.round(vv.height + vv.offsetTop) : 0
    const layout = window.innerHeight
    const base =
      Number.isFinite(fromTg) && fromTg > 80 ? Math.round(fromTg) : Math.max(layout, vvH)
    return Math.max(base, layout, vvH)
  }

  const apply = () => {
    const candidate = readCandidate()
    if (!candidate || candidate < 80) return
    // Только рост — никогда не сжимаем при открытии KB.
    if (candidate > locked + 1) {
      locked = candidate
      root.style.setProperty('--app-frame-height', `${locked}px`)
    } else if (locked > 0) {
      root.style.setProperty('--app-frame-height', `${locked}px`)
    }
  }

  apply()
  window.addEventListener('resize', apply)
  window.visualViewport?.addEventListener('resize', apply)
  window.addEventListener('orientationchange', () => {
    locked = 0
    window.setTimeout(apply, 280)
  })
  ;[50, 150, 400, 1000].forEach((ms) => window.setTimeout(apply, ms))
})