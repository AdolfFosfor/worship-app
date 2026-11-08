import type { ConfirmationOptions } from 'primevue/confirmationoptions'

type AppConfirmOptions = {
  /** Главный вопрос / заголовок */
  title: string
  /** Пояснение под заголовком (опционально) */
  message?: string
  acceptLabel?: string
  rejectLabel?: string
  accept: () => void | Promise<void>
}

/**
 * Confirm как нижний sheet (TMA), без дефолтного PrimeVue chrome.
 */
export function useAppConfirm() {
  const confirm = useConfirm()

  function requireDanger(options: AppConfirmOptions) {
    const payload: ConfirmationOptions = {
      position: 'bottom',
      header: options.title,
      message: options.message,
      acceptLabel: options.acceptLabel ?? 'Удалить',
      rejectLabel: options.rejectLabel ?? 'Отмена',
      defaultFocus: 'reject',
      blockScroll: true,
      appendTo: '.app-shell',
      accept: () => {
        void options.accept()
      },
    }
    confirm.require(payload)
  }

  return { requireDanger }
}
