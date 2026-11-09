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
  const { t } = useAppLocale()
  const haptics = useHaptics()

  function requireDanger(options: AppConfirmOptions) {
    haptics.warning()
    const payload: ConfirmationOptions = {
      position: 'bottom',
      header: options.title,
      message: options.message,
      acceptLabel: options.acceptLabel ?? t('common.delete'),
      rejectLabel: options.rejectLabel ?? t('common.cancel'),
      defaultFocus: 'reject',
      blockScroll: true,
      appendTo: '.app-shell',
      accept: () => {
        haptics.impact('heavy')
        void options.accept()
      },
    }
    confirm.require(payload)
  }

  return { requireDanger }
}
