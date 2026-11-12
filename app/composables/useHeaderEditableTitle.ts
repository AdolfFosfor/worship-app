/**
 * Сначала печать title в shell, затем (если canEdit) — Teleport editable.
 */
export function useHeaderEditableTitle(options: {
  title: MaybeRefOrGetter<string>
  canEdit: MaybeRefOrGetter<boolean>
  /** Сброс reveal при смене сущности (id песни/сета). */
  entityKey?: MaybeRefOrGetter<string | null | undefined>
  /** Доп. поля в header (subtitle / customSubtitle). */
  extra?: MaybeRefOrGetter<{
    subtitle?: string | null
    customSubtitle?: boolean
  }>
}) {
  const typed = useAppHeaderTyped()
  const revealEditable = ref(false)

  useAppHeader(() => ({
    title: toValue(options.title),
    typeMs: 11,
    eraseMs: 7,
    customTitle:
      revealEditable.value && toValue(options.canEdit) && Boolean(toValue(options.title)),
    ...(toValue(options.extra) ?? {}),
  }))

  function tryReveal() {
    const title = toValue(options.title)
    const canEdit = toValue(options.canEdit)
    if (!canEdit || !title) {
      revealEditable.value = false
      return
    }
    if (!typed.value.typing && typed.value.text === title) {
      revealEditable.value = true
    }
  }

  function resetReveal() {
    revealEditable.value = false
    void nextTick(tryReveal)
  }

  if (options.entityKey) {
    watch(
      () => toValue(options.entityKey),
      () => {
        resetReveal()
      },
    )
  }

  watch(
    () => toValue(options.title),
    () => {
      resetReveal()
    },
  )

  onActivated(resetReveal)
  onDeactivated(() => {
    revealEditable.value = false
  })

  watch(
    () => ({
      typing: typed.value.typing,
      text: typed.value.text,
      title: toValue(options.title),
      canEdit: toValue(options.canEdit),
    }),
    () => {
      tryReveal()
    },
    { immediate: true },
  )

  return {
    revealEditable: computed(
      () => revealEditable.value && toValue(options.canEdit) && Boolean(toValue(options.title)),
    ),
  }
}
