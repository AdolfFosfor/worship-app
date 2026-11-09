import { swipeBehavior } from '@tma.js/sdk-vue'

/**
 * Запрещает сворачивание / закрытие Mini App вертикальным свайпом по контенту.
 * Закрытие остаётся через кнопку Telegram (крестик / header).
 * Bot API 7.7+.
 */
export function disableTelegramVerticalSwipes(): () => void {
  try {
    if (!swipeBehavior.isSupported()) {
      return () => undefined
    }
    if (!swipeBehavior.isMounted()) {
      swipeBehavior.mount()
    }
    swipeBehavior.disableVertical()
  } catch {
    return () => undefined
  }

  return () => {
    try {
      // Не включаем обратно при HMR dispose — только unmount.
      swipeBehavior.unmount()
    } catch {
      // ignore
    }
  }
}
