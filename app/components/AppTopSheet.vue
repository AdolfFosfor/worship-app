<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

withDefaults(
  defineProps<{
    title: string
    expanded?: boolean
  }>(),
  {
    expanded: false,
  },
)

const emit = defineEmits<{
  dismiss: []
  'after-enter': []
}>()

const { t } = useAppLocale()

function onDismiss() {
  emit('dismiss')
}

function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !open.value) return
  event.preventDefault()
  onDismiss()
}

watch(open, (isOpen) => {
  if (isOpen) window.addEventListener('keydown', onEscape)
  else window.removeEventListener('keydown', onEscape)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEscape)
})
</script>

<template>
  <Teleport to=".app-shell">
    <Transition name="app-top-sheet" @after-enter="emit('after-enter')">
      <div
        v-if="open"
        class="app-top-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <button
          type="button"
          class="app-top-sheet__mask"
          :aria-label="t('common.close')"
          @click="onDismiss"
        />
        <div
          class="app-top-sheet__panel"
          :class="{ 'app-top-sheet__panel--expanded': expanded }"
        >
          <header class="app-top-sheet__head">
            <h2 class="app-top-sheet__title">{{ title }}</h2>
          </header>
          <div class="app-top-sheet__body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-top-sheet {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.app-top-sheet__mask {
  position: absolute;
  inset: 0;
  z-index: 0;
  border: 0;
  margin: 0;
  padding: 0;
  background: color-mix(in srgb, #000 48%, transparent);
  cursor: pointer;
  pointer-events: auto;
}

.app-top-sheet__panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
  /*
    Не vh/dvh — при OS KB viewport сжимается и панель «схлопывается».
    --app-frame-height залочен на stableHeight.
  */
  max-height: min(26rem, calc(var(--app-frame-height, 100lvh) * 0.52));
  padding-top: calc(
    max(var(--app-safe-top), env(safe-area-inset-top, 0px)) + var(--app-space-2)
  );
  padding-left: max(var(--app-safe-left), env(safe-area-inset-left, 0px));
  padding-right: max(var(--app-safe-right), env(safe-area-inset-right, 0px));
  padding-bottom: max(
    var(--app-safe-bottom),
    env(safe-area-inset-bottom, 0px),
    var(--app-space-3)
  );
  border-radius: 0 0 var(--app-radius-xl) var(--app-radius-xl);
  background: var(--app-surface);
  box-shadow: 0 16px 40px color-mix(in srgb, #000 28%, transparent);
  pointer-events: auto;
}

.app-top-sheet__panel--expanded {
  max-height: min(32rem, calc(var(--app-frame-height, 100lvh) * 0.72));
}

.app-top-sheet__head {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: var(--app-space-2) var(--app-page-inline) var(--app-space-1);
}

.app-top-sheet__title {
  margin: 0;
  min-width: 0;
  font-size: var(--app-text-lg);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--app-ink);
  text-align: center;
}

.app-top-sheet__body {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  flex: 1;
  min-height: 0;
  padding: var(--app-space-3) var(--app-page-inline) var(--app-space-4);
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

/* :deep — поля/choices могут быть вложены в слот (не только top-level) */
.app-top-sheet__body :deep(.app-top-sheet__choices) {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  width: 100%;
  min-height: 0;
}

.app-top-sheet__body :deep(.app-top-sheet__field) {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.65rem 0.75rem;
  border: var(--app-hairline) solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg);
  color: var(--app-ink);
  font: inherit;
  font-size: 16px;
  line-height: 1.35;
}

.app-top-sheet__body :deep(.app-top-sheet__form) {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  width: 100%;
  margin: 0;
}

.app-top-sheet__body :deep(.app-top-sheet__field--area) {
  flex: 1 1 auto;
  min-height: 10rem;
  height: 12rem;
  resize: none;
  -webkit-overflow-scrolling: touch;
}

.app-top-sheet__body :deep(.app-top-sheet__field--bpm) {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-align: center;
}

.app-top-sheet__body :deep(.app-top-sheet__add) {
  width: 100%;
  min-height: 2.75rem;
  padding: 0 0.85rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: var(--app-accent);
  color: var(--app-accent-contrast);
  font: inherit;
  font-size: var(--app-text-sm);
  font-weight: 750;
  cursor: pointer;
}

.app-top-sheet__body :deep(.app-top-sheet__add:disabled) {
  opacity: 0.45;
  cursor: default;
}

/* ПК: Enter / клик по маске — кнопка не нужна */
@media (hover: hover) and (pointer: fine) {
  .app-top-sheet__body :deep(.app-top-sheet__add) {
    display: none;
  }
}

.app-top-sheet-enter-active,
.app-top-sheet-leave-active {
  transition: opacity 160ms var(--app-ease, ease);
}

.app-top-sheet-enter-active .app-top-sheet__panel,
.app-top-sheet-leave-active .app-top-sheet__panel {
  transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

.app-top-sheet-enter-from,
.app-top-sheet-leave-to {
  opacity: 0;
}

.app-top-sheet-enter-from .app-top-sheet__panel,
.app-top-sheet-leave-to .app-top-sheet__panel {
  transform: translateY(-12%);
}
</style>
