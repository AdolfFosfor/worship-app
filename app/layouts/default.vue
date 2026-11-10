<script setup lang="ts">
const shellRef = ref<HTMLElement | null>(null)
const scrollRef = ref<HTMLElement | null>(null)
const { swiping, progressing } = useEdgeSwipeBack(shellRef)
useShellScrollMemory(scrollRef)
useTelegramBackButton()

const route = useRoute()
const confirm = useConfirm()
const { t } = useAppLocale()

const hideNav = computed(() => {
  const meta = route.meta as { hideNav?: boolean }
  return Boolean(meta.hideNav)
})

/** ConfirmDialog не пробрасывает dismissableMask — закрываем сами по клику на маску. */
function onConfirmMaskClick(event: MouseEvent) {
  if (event.target !== event.currentTarget) return
  confirm.close()
}

const confirmPt = {
  mask: {
    onClick: onConfirmMaskClick,
  },
}
</script>

<template>
  <div class="app-frame bg-[var(--app-bg)] text-[var(--app-ink)]">
    <div class="app-landscape-blocker" role="dialog" aria-live="polite">
      <p class="app-landscape-blocker__text">{{ t('layout.landscapeBlock') }}</p>
    </div>
    <div
      ref="shellRef"
      class="app-shell flex flex-col"
      :class="{
        'app-shell--with-nav': !hideNav,
        'app-shell--swiping': swiping,
        'app-shell--swipe-progress': progressing,
      }"
    >
      <div class="app-shell__swipe-underlay" aria-hidden="true">
        <div class="app-shell__swipe-underlay-card" />
      </div>

      <div class="app-shell__swipe-shade" aria-hidden="true" />

      <div class="app-shell__swipe-layer flex min-h-0 flex-1 flex-col">
        <Toast position="top-center" />
        <ConfirmDialog
          :draggable="false"
          :breakpoints="{ '960px': '100vw' }"
          :pt="confirmPt"
        >
          <template #container="{ message, acceptCallback, rejectCallback }">
            <div class="app-confirm">
              <div class="app-confirm__copy">
                <p v-if="message.header" class="app-confirm__title">{{ message.header }}</p>
                <p v-if="message.message" class="app-confirm__message">{{ message.message }}</p>
              </div>
              <div class="app-confirm__actions">
                <button
                  type="button"
                  class="app-confirm__btn app-confirm__btn--danger"
                  @click="acceptCallback"
                >
                  {{ message.acceptLabel || t('common.delete') }}
                </button>
                <button
                  type="button"
                  class="app-confirm__btn app-confirm__btn--cancel"
                  @click="rejectCallback"
                >
                  {{ message.rejectLabel || t('common.cancel') }}
                </button>
              </div>
            </div>
          </template>
        </ConfirmDialog>

        <main
          ref="scrollRef"
          class="app-shell__content min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-none"
        >
          <slot />
        </main>
      </div>

      <AppBottomNav v-if="!hideNav" class="app-shell__nav" />
    </div>
  </div>
</template>

<style scoped>
.app-frame {
  height: var(--app-frame-height, 100%);
  height: var(--app-frame-height, 100svh);
  overflow: hidden;
}

.app-shell {
  position: relative;
  height: 100%;
  overflow: hidden;
  padding-top: var(--app-safe-top);
  padding-right: var(--app-safe-right);
  padding-bottom: var(--app-safe-bottom);
  padding-left: var(--app-safe-left);
  background: var(--app-bg);
}

.app-shell--with-nav {
  padding-bottom: 0;
  --app-tabbar-clearance: calc(var(--app-nav-height, 3.25rem) + var(--app-safe-bottom));
}

.app-shell__swipe-underlay {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: flex;
  flex-direction: column;
  pointer-events: none;
  opacity: 0;
  transform: translate3d(-8%, 0, 0) scale(0.94);
  transform-origin: center left;
  will-change: transform, opacity;
}

.app-shell__swipe-underlay-card {
  flex: 1;
  margin: 0;
  border-radius: var(--app-radius, 0.75rem);
  background: var(--app-bg);
}

.app-shell__swipe-shade {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: #000;
  opacity: 0;
  will-change: opacity;
}

.app-shell__swipe-layer {
  position: relative;
  z-index: 2;
  min-width: 0;
  min-height: 0;
  /* С absolute-nav слой на всю высоту shell */
  flex: 1 1 auto;
  height: 100%;
  background: var(--app-bg);
  will-change: transform;
  backface-visibility: hidden;
}

.app-shell__nav {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3;
  background: var(--app-bottom-bar);
  /* Под OS KB: не display:none — просто уезжает под клавиатуру вместе с низом frame */
}

/* Контент на всю высоту; clearance таббара / KB — только padding scroller */
.app-shell--with-nav .app-shell__content {
  padding-bottom: calc(
    var(--app-tabbar-clearance, 3.75rem) + var(--app-keyboard-inset, 0px)
  );
}

/* KB / chord-dock: таббар не должен всплывать над клавиатурой */
.app-shell--keyboard-open.app-shell--with-nav,
.app-shell--chord-kb-open.app-shell--with-nav {
  --app-tabbar-clearance: 0px;
  padding-bottom: var(--app-safe-bottom);
}

.app-shell--keyboard-open .app-shell__nav,
.app-shell--chord-kb-open .app-shell__nav {
  display: none;
}

.app-shell--swiping {
  cursor: grabbing;
  touch-action: pan-y;
}

.app-shell--swipe-progress .app-shell__swipe-layer {
  /* Во время жеста слой над underlay; тень задаётся инлайном по прогрессу */
  isolation: isolate;
}

/* On wide screens keep a deliberate phone-width column instead of a tiny island */
@media (min-width: 720px) {
  .app-frame {
    display: flex;
    justify-content: center;
    background: var(--app-bg);
  }

  .app-shell {
    width: 100%;
    max-width: 28rem;
    border-inline: 1px solid var(--app-border);
  }
}

@media (min-width: 1100px) {
  .app-shell {
    max-width: 30rem;
  }
}

.app-landscape-blocker {
  display: none;
}

@media (max-height: 500px) and (orientation: landscape) {
  .app-landscape-blocker {
    position: fixed;
    inset: 0;
    z-index: 100000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding:
      max(1.25rem, var(--app-safe-top))
      max(1.25rem, var(--app-safe-right))
      max(1.25rem, var(--app-safe-bottom))
      max(1.25rem, var(--app-safe-left));
    background: var(--app-bg);
    color: var(--app-ink);
    text-align: center;
  }

  .app-landscape-blocker__text {
    margin: 0;
    max-width: 16rem;
    font-size: var(--app-text-md);
    font-weight: 600;
    line-height: 1.35;
  }

  .app-shell {
    visibility: hidden;
    pointer-events: none;
  }
}
</style>

<style>
/*
  Toast всегда Portal → body (у PrimeVue 4 нет appendTo).
  Ширину клампим к колонке .app-shell (28/30rem) и вычитаем safe + ритм страницы.
*/
.p-toast {
  top: var(--app-toast-offset-top) !important;
  left: 50% !important;
  right: auto !important;
  transform: translateX(-50%);
  width: min(
    calc(28rem - 2 * var(--app-space-4)),
    calc(100% - var(--app-safe-left) - var(--app-safe-right) - 2 * var(--app-space-4))
  );
  max-width: none;
  padding-left: 0;
  padding-right: 0;
}

@media (min-width: 1100px) {
  .p-toast {
    width: min(
      calc(30rem - 2 * var(--app-space-4)),
      calc(100% - var(--app-safe-left) - var(--app-safe-right) - 2 * var(--app-space-4))
    );
  }
}

/* Aura detailColor = surface-0 (#17212b) — нечитаемо на тёмной теме */
.p-toast .p-toast-message {
  background: var(--app-surface) !important;
  border: 1px solid var(--app-border) !important;
  color: var(--app-ink) !important;
  box-shadow: 0 8px 24px color-mix(in srgb, #000 35%, transparent);
}

.p-toast .p-toast-summary,
.p-toast .p-toast-detail,
.p-toast .p-toast-message-text {
  color: var(--app-ink) !important;
}

.p-toast .p-toast-detail {
  opacity: 0.85;
}

.p-toast .p-toast-message-error {
  border-left: 3px solid var(--app-danger) !important;
}

.p-toast .p-toast-message-success {
  border-left: 3px solid var(--app-success) !important;
}

.p-toast .p-toast-message-info,
.p-toast .p-toast-message-warn {
  border-left: 3px solid var(--app-accent) !important;
}

.p-toast .p-toast-message-error .p-toast-message-icon {
  color: var(--app-danger) !important;
}

.p-toast .p-toast-message-success .p-toast-message-icon {
  color: var(--app-success) !important;
}

/*
  Dialog appendTo=".app-shell": fixed иначе на ПК кроет весь viewport.
  Absolute — маска и «фулскрин» только внутри колонки приложения.
*/
.app-shell > .p-dialog-mask,
.app-shell .p-dialog-mask {
  position: absolute !important;
  inset: 0 !important;
  width: auto !important;
  height: auto !important;
}

.p-dialog-mask {
  padding-top: var(--app-safe-top);
  padding-bottom: var(--app-safe-bottom);
  padding-left: var(--app-safe-left);
  padding-right: var(--app-safe-right);
}

.p-dialog,
.p-confirmdialog.p-dialog {
  background: var(--app-surface) !important;
  color: var(--app-ink) !important;
  border: 0 !important;
  border-radius: var(--app-radius-xl) !important;
  box-shadow: var(--app-shadow-soft) !important;
}

/* Пикер песен на весь .app-shell (не viewport) */
.p-dialog.setlist-song-picker {
  width: 100% !important;
  max-width: 100% !important;
  height: 100% !important;
  max-height: 100% !important;
  margin: 0 !important;
  display: flex !important;
  flex-direction: column !important;
}

.p-dialog.setlist-song-picker .p-dialog-header {
  flex-shrink: 0;
}

.p-dialog.setlist-song-picker .p-dialog-content,
.p-dialog.setlist-song-picker .setlist-song-picker__content {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
}

.p-dialog .p-dialog-header {
  align-items: center !important;
  gap: var(--app-space-2) !important;
  padding: 0.7rem var(--app-space-4) !important;
  min-height: 0 !important;
}

.p-dialog .p-dialog-title {
  font-size: var(--app-text-lg) !important;
  font-weight: 700 !important;
  letter-spacing: -0.02em !important;
  line-height: 1.25 !important;
}

.p-dialog .p-dialog-title,
.p-dialog .p-dialog-content,
.p-dialog .p-confirm-dialog-message {
  color: var(--app-ink) !important;
}

.p-dialog .p-dialog-content {
  padding-top: var(--app-space-2) !important;
}

.p-dialog .p-dialog-close-button {
  width: 2.25rem !important;
  height: 2.25rem !important;
  color: var(--app-muted) !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}

.p-dialog .p-dialog-close-button:hover,
.p-dialog .p-dialog-close-button:focus-visible {
  color: var(--app-ink) !important;
  background: var(--app-hover) !important;
}

.p-dialog .p-dialog-close-button:active {
  color: var(--app-ink) !important;
  background: var(--app-press) !important;
}

/* Confirm — нижний sheet в стиле TMA */
.p-dialog-mask:has(.p-confirmdialog) {
  align-items: flex-end !important;
  justify-content: center !important;
  /* sheet сам учитывает safe-bottom; маске safe-area не нужны */
  padding: 0 !important;
  /* свой цвет + !important: иначе leave прыгает на dt(mask.background) и мигает */
  background: color-mix(in srgb, #000 48%, transparent) !important;
  cursor: pointer;
}

/* Enter: без анимации фона. Leave: только opacity всего слоя (без смены background). */
.p-dialog-mask:has(.p-confirmdialog).p-overlay-mask-enter-active {
  animation: none !important;
}

.p-dialog-mask:has(.p-confirmdialog).p-overlay-mask-leave-active {
  animation: app-confirm-mask-leave 120ms linear forwards !important;
}

.p-confirmdialog.p-dialog {
  width: min(28rem, 100%) !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 1.25rem 1.25rem 0 0 !important;
  box-shadow: 0 -16px 40px color-mix(in srgb, #000 32%, transparent);
  overflow: hidden;
  cursor: default;
  will-change: transform;
}

.p-confirmdialog.p-dialog-enter-active {
  animation: app-confirm-enter 160ms cubic-bezier(0.32, 0.72, 0, 1) !important;
}

.p-confirmdialog.p-dialog-leave-active {
  animation: app-confirm-leave 120ms cubic-bezier(0.4, 0, 1, 1) !important;
}

@keyframes app-confirm-enter {
  from {
    transform: translateY(100%);
  }
}

@keyframes app-confirm-leave {
  to {
    transform: translateY(100%);
  }
}

@keyframes app-confirm-mask-leave {
  to {
    opacity: 0;
  }
}

.app-confirm {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-5);
  padding: var(--app-space-5) var(--app-space-4)
    calc(var(--app-space-4) + var(--app-safe-bottom));
}

.app-confirm__copy {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  padding-inline: var(--app-space-1);
  text-align: center;
}

.app-confirm__title {
  margin: 0;
  font-size: var(--app-text-lg);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.3;
  color: var(--app-ink);
}

.app-confirm__message {
  margin: 0;
  font-size: var(--app-text-md);
  line-height: 1.4;
  color: var(--app-muted);
}

.app-confirm__actions {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.app-confirm__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: var(--app-touch-min);
  padding: 0.75rem 1rem;
  border-radius: var(--app-radius-lg);
  border: 0;
  font: inherit;
  font-weight: 650;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition:
    background-color var(--app-duration) var(--app-ease),
    transform var(--app-duration) var(--app-ease);
}

.app-confirm__btn:active {
  transform: scale(0.985);
}

.app-confirm__btn--danger {
  background: color-mix(in srgb, var(--app-destructive) 16%, var(--app-surface));
  color: var(--app-destructive);
}

.app-confirm__btn--danger:active {
  background: color-mix(in srgb, var(--app-destructive) 24%, var(--app-surface));
}

.app-confirm__btn--cancel {
  background: var(--app-hover);
  color: var(--app-ink);
}

.app-confirm__btn--cancel:active {
  background: color-mix(in srgb, var(--app-ink) 12%, var(--app-surface));
}

/*
  Select/Popover overlays teleport в body и часто остаются на Aura light/dark,
  игнорируя Telegram --app-*. Форсим текущую тему приложения.
*/
.p-select-overlay,
.p-multiselect-overlay,
.p-datepicker-panel,
.p-popover,
.p-tieredmenu,
.p-menu.p-component {
  background: var(--app-surface) !important;
  color: var(--app-ink) !important;
  border: 1px solid var(--app-border) !important;
  box-shadow: 0 10px 28px color-mix(in srgb, #000 28%, transparent) !important;
}

.p-select-list,
.p-multiselect-list,
.p-select-list-container,
.p-multiselect-list-container {
  background: transparent !important;
  color: var(--app-ink) !important;
}

.p-select-list-container,
.p-multiselect-list-container {
  max-height: min(18rem, 50svh) !important;
}

.p-select-option,
.p-multiselect-option,
.p-select-option .p-select-option-label {
  color: var(--app-ink) !important;
}

.p-select-option:not(.p-select-option-selected):not(.p-disabled):hover,
.p-select-option:not(.p-select-option-selected):not(.p-disabled).p-focus,
.p-multiselect-option:not(.p-multiselect-option-selected):not(.p-disabled):hover,
.p-multiselect-option:not(.p-multiselect-option-selected):not(.p-disabled).p-focus {
  background: var(--app-hover) !important;
  color: var(--app-ink) !important;
}

.p-select-option.p-select-option-selected,
.p-multiselect-option.p-multiselect-option-selected {
  background: var(--app-accent-muted) !important;
  color: var(--app-accent-text) !important;
}

.p-select-option.p-select-option-selected.p-focus,
.p-multiselect-option.p-multiselect-option-selected.p-focus {
  background: color-mix(in srgb, var(--app-accent) 22%, var(--app-surface)) !important;
  color: var(--app-accent-text) !important;
}

.p-select-overlay .p-select-header,
.p-multiselect-overlay .p-multiselect-header,
.p-select-overlay .p-select-filter,
.p-multiselect-overlay .p-multiselect-filter {
  background: var(--app-bg) !important;
  color: var(--app-ink) !important;
  border-color: var(--app-border) !important;
}

.p-select,
.p-multiselect {
  background: var(--app-surface) !important;
  color: var(--app-ink) !important;
  border: 1px solid var(--app-border) !important;
}

.p-select .p-select-label,
.p-select .p-select-dropdown,
.p-multiselect .p-multiselect-label,
.p-multiselect .p-multiselect-dropdown {
  color: var(--app-ink) !important;
}

.p-select .p-select-label.p-placeholder,
.p-multiselect .p-multiselect-label.p-placeholder {
  color: var(--app-muted) !important;
}

/* DatePicker — force app tokens (input + dropdown + panel) */
.p-datepicker {
  background: var(--app-surface) !important;
  border: 1px solid var(--app-border) !important;
  border-radius: var(--app-radius) !important;
  color: var(--app-ink) !important;
  overflow: hidden;
}

.p-datepicker:not(.p-disabled):hover {
  border-color: var(--app-border-strong) !important;
}

.p-datepicker .p-datepicker-input,
.p-datepicker .p-inputtext {
  background: transparent !important;
  color: var(--app-ink) !important;
  border: 0 !important;
  box-shadow: none !important;
}

.p-datepicker .p-datepicker-dropdown {
  background: var(--app-accent-muted) !important;
  color: var(--app-accent-text) !important;
  border: 0 !important;
  border-inline-start: 1px solid var(--app-border) !important;
  width: 2.75rem !important;
}

.p-datepicker .p-datepicker-dropdown:hover {
  background: color-mix(in srgb, var(--app-accent) 22%, var(--app-surface)) !important;
  color: var(--app-accent-text) !important;
}

.p-datepicker-panel {
  background: var(--app-surface) !important;
  color: var(--app-ink) !important;
  border: 1px solid var(--app-border) !important;
}

.p-datepicker-panel .p-datepicker-header,
.p-datepicker-panel .p-datepicker-title,
.p-datepicker-panel .p-datepicker-select-month,
.p-datepicker-panel .p-datepicker-select-year,
.p-datepicker-panel .p-datepicker-weekday,
.p-datepicker-panel .p-datepicker-day {
  color: var(--app-ink) !important;
}

.p-datepicker-panel .p-datepicker-header {
  background: var(--app-surface) !important;
  border-bottom: 1px solid var(--app-border) !important;
}

.p-datepicker-panel .p-datepicker-day:not(.p-datepicker-day-selected):not(.p-disabled):hover {
  background: var(--app-hover) !important;
}

.p-datepicker-panel .p-datepicker-day-selected {
  background: var(--app-accent) !important;
  color: var(--app-accent-contrast) !important;
}

.p-datepicker-panel .p-datepicker-today > .p-datepicker-day:not(.p-datepicker-day-selected) {
  background: var(--app-accent-muted) !important;
  color: var(--app-accent-text) !important;
}

.p-datepicker-panel .p-datepicker-prev-button,
.p-datepicker-panel .p-datepicker-next-button {
  color: var(--app-accent-text) !important;
}
</style>
