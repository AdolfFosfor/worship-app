/**
 * TMA / iOS WebView: при фокусе в input окно «уезжает» (window.scrollY),
 * а клавиатура перекрывает поле. Фиксируем layout viewport и
 * при необходимости доскролливаем внутри .app-shell__content.
 */

const KEYBOARD_OPEN_PX = 100
const PIN_DELAYS_MS = [0, 50, 120, 280] as const

function isEditable(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA') return true
  if (tag !== 'INPUT') return false
  if (!(el instanceof HTMLInputElement)) return false
  const type = (el.type || 'text').toLowerCase()
  return ![
    'button',
    'checkbox',
    'radio',
    'file',
    'submit',
    'reset',
    'range',
    'color',
    'hidden',
    'image',
  ].includes(type)
}

function pinWindowScroll() {
  if (window.scrollX !== 0 || window.scrollY !== 0) {
    window.scrollTo(0, 0)
  }
  if (document.documentElement.scrollTop) {
    document.documentElement.scrollTop = 0
  }
  if (document.body.scrollTop) {
    document.body.scrollTop = 0
  }
}

function schedulePin() {
  for (const ms of PIN_DELAYS_MS) {
    window.setTimeout(pinWindowScroll, ms)
  }
}

function keyboardInset(): number {
  const vv = window.visualViewport
  if (!vv) return 0
  return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
}

function setKeyboardOpen(open: boolean) {
  document.documentElement.classList.toggle('app-keyboard-open', open)
  document.querySelector('.app-shell')?.classList.toggle('app-shell--keyboard-open', open)
  document.documentElement.style.setProperty(
    '--app-keyboard-inset',
    open ? `${keyboardInset()}px` : '0px',
  )
}

function ensureFocusedVisible(el: HTMLElement) {
  const scroller = document.querySelector<HTMLElement>('.app-shell__content')
  const vv = window.visualViewport
  const visibleTop = vv?.offsetTop ?? 0
  const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight
  const rect = el.getBoundingClientRect()
  const pad = 16

  if (!scroller) {
    if (rect.bottom > visibleBottom - pad || rect.top < visibleTop + pad) {
      el.scrollIntoView({ block: 'center', inline: 'nearest' })
    }
    return
  }

  if (rect.bottom > visibleBottom - pad) {
    scroller.scrollTop += rect.bottom - (visibleBottom - pad)
  } else if (rect.top < visibleTop + pad) {
    scroller.scrollTop -= visibleTop + pad - rect.top
  }
}

function syncFromViewport() {
  const open = keyboardInset() >= KEYBOARD_OPEN_PX
  setKeyboardOpen(open)
  pinWindowScroll()
  const active = document.activeElement
  if (open && isEditable(active)) {
    ensureFocusedVisible(active)
  }
}

export default defineNuxtPlugin(() => {
  const onTouchEnd = (event: TouchEvent) => {
    const el = event.target
    if (!isEditable(el)) return
    if (document.activeElement === el) return
    // До нативного focus+scroll: фокус без сдвига layout viewport.
    event.preventDefault()
    el.focus({ preventScroll: true })
    pinWindowScroll()
    requestAnimationFrame(() => {
      pinWindowScroll()
      ensureFocusedVisible(el)
      syncFromViewport()
    })
    schedulePin()
  }

  const onFocusIn = (event: FocusEvent) => {
    if (!isEditable(event.target)) return
    pinWindowScroll()
    schedulePin()
    requestAnimationFrame(() => {
      ensureFocusedVisible(event.target as HTMLElement)
      syncFromViewport()
    })
  }

  const onFocusOut = () => {
    window.setTimeout(() => {
      if (!isEditable(document.activeElement)) {
        setKeyboardOpen(false)
        pinWindowScroll()
      }
    }, 180)
  }

  document.addEventListener('touchend', onTouchEnd, { capture: true, passive: false })
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
  window.addEventListener('scroll', pinWindowScroll, { passive: true })
  window.visualViewport?.addEventListener('resize', syncFromViewport)
  window.visualViewport?.addEventListener('scroll', () => {
    pinWindowScroll()
    syncFromViewport()
  })
})
