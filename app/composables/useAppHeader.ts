export type AppHeaderTitleSize = 'default' | 'display'

export type AppHeaderConfig = {
  /** Заголовок для печатной анимации (если не customTitle). */
  title?: string
  subtitle?: string | null
  /** Страница телепортит свой title (editable и т.п.). */
  customTitle?: boolean
  /** Страница телепортит свой subtitle. */
  customSubtitle?: boolean
  /** Скрыть shell-header (login и т.п.). */
  visible?: boolean
  /** display = крупный как editable title песни/сета (2.125rem). */
  titleSize?: AppHeaderTitleSize
  /** мс на символ при печати. */
  typeMs?: number
  /** мс на символ при стирании. */
  eraseMs?: number
}

type HeaderState = {
  title: string
  subtitle: string | null
  customTitle: boolean
  customSubtitle: boolean
  visible: boolean
  titleSize: AppHeaderTitleSize
  typeMs: number
  eraseMs: number
}

type HeaderTypedState = {
  text: string
  typing: boolean
}

const DEFAULT_TYPE_MS = 22
const DEFAULT_ERASE_MS = 14

function headerState() {
  return useState<HeaderState>('app-shell-header', () => ({
    title: '',
    subtitle: null,
    customTitle: false,
    customSubtitle: false,
    visible: true,
    titleSize: 'default',
    typeMs: DEFAULT_TYPE_MS,
    eraseMs: DEFAULT_ERASE_MS,
  }))
}

/** Состояние печатной анимации (пишет AppShellHeader). */
export function useAppHeaderTyped() {
  return useState<HeaderTypedState>('app-shell-header-typed', () => ({
    text: '',
    typing: false,
  }))
}

/**
 * Единый хедер в layout: страницы задают title/subtitle и Teleport trailing.
 * Сам DOM хедера не пересоздаётся при смене вкладки.
 *
 * KeepAlive: watch на деактивированной странице на паузе и при возврате
 * не срабатывает, если конфиг не изменился — поэтому sync ещё и в onActivated.
 */
export function useAppHeader(config?: MaybeRefOrGetter<AppHeaderConfig>) {
  const state = headerState()

  function apply(next: AppHeaderConfig) {
    if (next.title !== undefined) state.value.title = next.title
    if (next.subtitle !== undefined) state.value.subtitle = next.subtitle
    if (next.customTitle !== undefined) state.value.customTitle = next.customTitle
    if (next.customSubtitle !== undefined) state.value.customSubtitle = next.customSubtitle
    if (next.visible !== undefined) state.value.visible = next.visible
    if (next.titleSize !== undefined) state.value.titleSize = next.titleSize
    if (next.typeMs !== undefined) state.value.typeMs = next.typeMs
    if (next.eraseMs !== undefined) state.value.eraseMs = next.eraseMs
  }

  function sync() {
    if (!config) return
    apply({
      visible: true,
      customTitle: false,
      customSubtitle: false,
      subtitle: null,
      titleSize: 'default',
      typeMs: DEFAULT_TYPE_MS,
      eraseMs: DEFAULT_ERASE_MS,
      ...toValue(config),
    })
  }

  if (config) {
    watch(() => toValue(config), sync, { immediate: true, deep: true })
    onActivated(sync)
  }

  const typed = useAppHeaderTyped()

  return {
    title: computed(() => state.value.title),
    subtitle: computed(() => state.value.subtitle),
    customTitle: computed(() => state.value.customTitle),
    customSubtitle: computed(() => state.value.customSubtitle),
    visible: computed(() => state.value.visible),
    titleSize: computed(() => state.value.titleSize),
    typeMs: computed(() => state.value.typeMs),
    eraseMs: computed(() => state.value.eraseMs),
    typedText: computed(() => typed.value.text),
    isTyping: computed(() => typed.value.typing),
    apply,
  }
}
