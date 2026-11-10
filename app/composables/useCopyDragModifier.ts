import { useMagicKeys } from '@vueuse/core'

type ModifierEvent = {
  altKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  pointerType?: string
}

/**
 * ⌥/Alt (Figma-style) + Ctrl/Shift — запасные модификаторы copy-DnD.
 * `armed` липкий на жест: ложный keyup / WebView не сбрасывают copy до reset().
 */
export function useCopyDragModifier(isDraggingCopyable: MaybeRefOrGetter<boolean>) {
  const { alt, ctrl, shift } = useMagicKeys({
    passive: false,
    onEventFired(e) {
      if (!toValue(isDraggingCopyable)) return
      if (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight') {
        e.preventDefault()
      }
    },
  })

  const pressed = computed(
    () => Boolean(alt.value || ctrl.value || shift.value),
  )

  const armed = ref(false)

  watch(pressed, (on) => {
    if (on && toValue(isDraggingCopyable)) armed.value = true
  })

  function armFromPointerEvent(e: ModifierEvent) {
    if (e.pointerType === 'touch') return
    if (e.altKey || e.ctrlKey || e.shiftKey || pressed.value) {
      armed.value = true
    }
  }

  /** Пометить copy на уже идущем жесте (после mid-drag ⌥). */
  function forceArm() {
    armed.value = true
  }

  function reset() {
    armed.value = false
  }

  const wantsCopy = computed(() => armed.value || pressed.value)

  const isDuplicating = computed(
    () => toValue(isDraggingCopyable) && wantsCopy.value,
  )

  return {
    pressed,
    armed,
    wantsCopy,
    isDuplicating,
    armFromPointerEvent,
    forceArm,
    reset,
  }
}
