<script setup lang="ts">
const shellRef = ref<HTMLElement | null>(null)
const scrollRef = ref<HTMLElement | null>(null)
const { swiping, progressing } = useEdgeSwipeBack(shellRef)
useShellScrollMemory(scrollRef)

const route = useRoute()

const hideNav = computed(() => {
  const meta = route.meta as { hideNav?: boolean }
  return Boolean(meta.hideNav)
})
</script>

<template>
  <div class="app-frame bg-[var(--app-bg)] text-[var(--app-ink)]">
    <div class="app-landscape-blocker" role="dialog" aria-live="polite">
      <p class="app-landscape-blocker__text">Поверните устройство вертикально</p>
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
        <Toast position="top-center" append-to=".app-shell" />
        <ConfirmDialog append-to=".app-shell" />

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
  background: var(--app-bg);
  will-change: transform;
  backface-visibility: hidden;
}

.app-shell__nav {
  z-index: 3;
  background: var(--app-bottom-bar);
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
  Toast/Dialog часто teleport в body (appendTo к .app-shell не всегда срабатывает),
  поэтому контраст — без предка .app-shell.
*/
.p-toast {
  top: var(--app-toast-offset-top) !important;
  left: 50% !important;
  right: auto !important;
  transform: translateX(-50%);
  width: min(22rem, calc(100% - 1.5rem));
  padding-left: var(--app-safe-left);
  padding-right: var(--app-safe-right);
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

.p-dialog-mask,
.p-confirmdialog {
  padding-top: var(--app-safe-top);
  padding-bottom: var(--app-safe-bottom);
  padding-left: var(--app-safe-left);
  padding-right: var(--app-safe-right);
}

.p-dialog,
.p-confirmdialog .p-dialog {
  background: var(--app-surface) !important;
  color: var(--app-ink) !important;
  border: 1px solid var(--app-border) !important;
}

.p-dialog .p-dialog-title,
.p-dialog .p-dialog-content,
.p-dialog .p-confirm-dialog-message {
  color: var(--app-ink) !important;
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
  background: var(--app-bg) !important;
  color: var(--app-ink) !important;
  border-color: var(--app-border) !important;
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
  background: var(--app-bg) !important;
  border-color: var(--app-border) !important;
  color: var(--app-ink) !important;
}

.p-datepicker .p-datepicker-input,
.p-datepicker .p-inputtext {
  background: transparent !important;
  color: var(--app-ink) !important;
  border: 0 !important;
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
