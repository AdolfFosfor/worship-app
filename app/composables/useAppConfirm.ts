import type { ConfirmationOptions } from 'primevue/confirmationoptions'

type AppConfirmOptions = {
  /** Главный вопрос / заголовок */
  title: string
  /** Пояснение под заголовком (опционально) */
  message?: string
  acceptLabel?: string
  rejectLabel?: string
  accept: () => void | Promise<void>
  /** Закрытие / Отмена — для async gate (route leave и т.п.) */
  reject?: () => void | Promise<void>
}

/**
 * Confirm как нижний sheet (TMA), без дефолтного PrimeVue chrome.
 */
export function useAppConfirm() {
  const confirm = useConfirm()
  const { t } = useAppLocale()
  const haptics = useHaptics()

  function openConfirm(
    options: AppConfirmOptions,
    opts: { acceptClass: string; warningHaptic: boolean },
  ) {
    if (opts.warningHaptic) haptics.warning()
    else haptics.tap()

    /** Маска зовёт close() без reject — onHide добивает один settle. */
    let settled = false
    const settle = (kind: 'accept' | 'reject') => {
      if (settled) return
      settled = true
      if (kind === 'accept') void options.accept()
      else void options.reject?.()
    }

    const payload: ConfirmationOptions = {
      position: 'bottom',
      header: options.title,
      message: options.message,
      acceptLabel: options.acceptLabel ?? t('common.confirm'),
      rejectLabel: options.rejectLabel ?? t('common.cancel'),
      acceptClass: opts.acceptClass,
      defaultFocus: 'reject',
      blockScroll: true,
      appendTo: '.app-shell',
      accept: () => {
        haptics.impact(opts.warningHaptic ? 'heavy' : 'medium')
        settle('accept')
      },
      reject: () => settle('reject'),
      onHide: () => settle('reject'),
    }
    confirm.require(payload)
  }

  /** Удаление / необратимое — красная кнопка */
  function requireDanger(options: AppConfirmOptions) {
    openConfirm(
      {
        ...options,
        acceptLabel: options.acceptLabel ?? t('common.delete'),
      },
      { acceptClass: 'app-confirm__btn--danger', warningHaptic: true },
    )
  }

  /** Обычное подтверждение (публикация и т.п.) — акцентная кнопка */
  function requireConfirm(options: AppConfirmOptions) {
    openConfirm(options, {
      acceptClass: 'app-confirm__btn--accent',
      warningHaptic: false,
    })
  }

  return { requireDanger, requireConfirm }
}
