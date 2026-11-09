import {
  hapticFeedback,
  type ImpactHapticFeedbackStyle,
  type NotificationHapticFeedbackType,
} from '@tma.js/sdk-vue'

/**
 * Telegram Mini App haptic feedback (Bot API 6.1+).
 * Вне Telegram / без поддержки — тихий no-op.
 */
export function useHaptics() {
  function supported() {
    if (!import.meta.client) return false
    try {
      return Boolean(hapticFeedback.isSupported())
    } catch {
      return false
    }
  }

  function impact(style: ImpactHapticFeedbackStyle = 'light') {
    if (!supported()) return
    try {
      hapticFeedback.impactOccurred(style)
    } catch {
      // ignore
    }
  }

  function notification(type: NotificationHapticFeedbackType) {
    if (!supported()) return
    try {
      hapticFeedback.notificationOccurred(type)
    } catch {
      // ignore
    }
  }

  function selection() {
    if (!supported()) return
    try {
      hapticFeedback.selectionChanged()
    } catch {
      // ignore
    }
  }

  return {
    supported,
    impact,
    notification,
    selection,
    /** Тап по кнопке / chip */
    tap: () => impact('light'),
    /** Старт drag / важное действие */
    grab: () => impact('medium'),
    /** Drop / commit reorder */
    drop: () => impact('rigid'),
    /** Переключение сегментов / капо / слот drop */
    tick: () => selection(),
    success: () => notification('success'),
    warning: () => notification('warning'),
    error: () => notification('error'),
  }
}
