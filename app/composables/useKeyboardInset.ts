/**
 * Visual Viewport → padding контента над OS KB.
 * Nav absolute снизу (под клавиатурой), не участвует в flex-зазоре.
 */

export type KeyboardMode = 'none' | 'overlay'

const OPEN_PX = 60
const STARTED = 'keyboard-inset-started'

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

export function useKeyboardInset() {
  const inset = useState('kb-inset', () => 0)
  const open = useState('kb-inset-open', () => false)

  function applyCss(fieldFocused: boolean) {
    if (!import.meta.client) return
    const root = document.documentElement
    root.style.setProperty('--app-keyboard-inset', `${inset.value}px`)
    // Прячем nav только при реальном overlap KB. Голый focus (ПК / без soft KB)
    // не должен убирать нижнее меню.
    const hideNav = fieldFocused && open.value
    root.classList.toggle('app-keyboard-open', hideNav)
    document
      .querySelector('.app-shell')
      ?.classList.toggle('app-shell--keyboard-open', hideNav)
  }

  function measure() {
    if (!import.meta.client) return

    const vv = window.visualViewport
    const focused = isEditable(document.activeElement)

    if (!vv || !focused) {
      inset.value = 0
      open.value = false
      applyCss(false)
      return
    }

    // Насколько KB перекрывает низ shell (для padding). В host-shrink может быть ≈0.
    const shell = document.querySelector<HTMLElement>('.app-shell')
    const vvBottom = vv.offsetTop + vv.height
    const overlap = shell
      ? Math.max(0, Math.round(shell.getBoundingClientRect().bottom - vvBottom))
      : Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))

    const next = overlap >= OPEN_PX ? overlap : 0
    inset.value = next
    open.value = next >= OPEN_PX
    applyCss(true)
  }

  function ensureVisible(el: HTMLElement) {
    if (!import.meta.client) return
    const scroller = document.querySelector<HTMLElement>('.app-shell__content')
    const vv = window.visualViewport
    if (!scroller || !vv) return

    const pad = 20
    const composer =
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--app-composer-inset'),
      ) || 0

    // Видимое окно = visualViewport минус composer.
    const visibleTop = vv.offsetTop + pad
    const visibleBottom = vv.offsetTop + vv.height - composer - pad
    if (visibleBottom - visibleTop < 72) return

    const rect = el.getBoundingClientRect()
    // Целиком поле + небольшой зазор над низом видимой области.
    const needBottom = rect.bottom + 12
    const needTop = rect.top - 12

    if (needBottom > visibleBottom) {
      scroller.scrollTop += needBottom - visibleBottom
    } else if (needTop < visibleTop) {
      scroller.scrollTop -= visibleTop - needTop
    }

    const action = el
      .closest('form')
      ?.querySelector<HTMLElement>('button[type="submit"], .p-button[type="submit"]')
    if (action) {
      const ar = action.getBoundingClientRect()
      if (ar.bottom + 8 > visibleBottom) {
        scroller.scrollTop += ar.bottom + 8 - visibleBottom
      }
    }
  }

  function start() {
    if (!import.meta.client) return
    const started = useState(STARTED, () => false)
    if (started.value) {
      measure()
      return
    }
    started.value = true

    measure()

    const onVv = () => {
      measure()
      const el = document.activeElement
      if (
        isEditable(el) &&
        !el.closest(
          '.chart-note-sheet, .chord-kb, .member-sheet, .song-top-sheet, .create-setlist-sheet',
        )
      ) {
        ensureVisible(el)
      }
    }
    window.visualViewport?.addEventListener('resize', onVv)
    window.visualViewport?.addEventListener('scroll', onVv)
    window.addEventListener('resize', onVv)

    document.addEventListener('focusin', (event) => {
      if (!isEditable(event.target)) return
      const el = event.target as HTMLElement
      measure()
      if (
        el.closest(
          '.chart-note-sheet, .chord-kb, .member-sheet, .song-top-sheet, .create-setlist-sheet',
        )
      ) {
        requestAnimationFrame(() => measure())
        return
      }
      const settle = () => {
        measure()
        if (document.activeElement === el) ensureVisible(el)
      }
      requestAnimationFrame(() => {
        settle()
        window.setTimeout(settle, 120)
        window.setTimeout(settle, 320)
      })
    })

    document.addEventListener('focusout', () => {
      // Чуть дольше: iOS часто blur→focus при смене полей — не мигаем nav.
      window.setTimeout(() => {
        if (isEditable(document.activeElement)) {
          measure()
          return
        }
        measure()
      }, 160)
    })
  }

  return {
    inset,
    open,
    start,
    measure,
    ensureVisible,
    isEditable,
  }
}

/** Совместимость со старыми импортами. */
export function useKeyboardChrome() {
  const kb = useKeyboardInset()
  return {
    keyboardMode: computed(() => (kb.open.value ? 'overlay' : 'none')),
    keyboardInset: kb.inset,
    keyboardOpen: kb.open,
    vvHeight: useState('kb-vv-h-compat', () => 0),
    vvOffsetTop: useState('kb-vv-top-compat', () => 0),
    frameLocked: useState('kb-frame-compat', () => 0),
    start: kb.start,
    measure: kb.measure,
    pinWindowScroll: () => undefined,
    shellScroller: () =>
      import.meta.client
        ? document.querySelector<HTMLElement>('.app-shell__content')
        : null,
    visibleRect: () => ({
      top: 0,
      bottom: import.meta.client ? window.innerHeight : 0,
      height: import.meta.client ? window.innerHeight : 0,
      left: 0,
      right: import.meta.client ? window.innerWidth : 0,
    }),
    isEditable: kb.isEditable,
  }
}
