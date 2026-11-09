<script setup lang="ts">
import { icons } from '~/utils/icons'
import { clampCapo } from '~/utils/music/capo'

const { t } = useAppLocale()

const props = defineProps<{
  modelValue: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function shift(delta: number) {
  emit('update:modelValue', clampCapo(props.modelValue + delta))
}

const fret = computed(() => clampCapo(props.modelValue))
const isNone = computed(() => fret.value === 0)
</script>

<template>
  <div class="capo-stepper">
    <button
      type="button"
      class="capo-stepper__btn"
      :aria-label="t('capo.ariaDown')"
      :disabled="fret <= 0"
      @click="shift(-1)"
    >
      <AppIcon :name="icons.minus" size="1.25rem" />
    </button>
    <span
      class="capo-stepper__value"
      :class="{ 'capo-stepper__value--none': isNone }"
      :aria-label="isNone ? t('capo.none') : undefined"
    >
      <AppIcon v-if="isNone" :name="icons.none" size="1.15rem" />
      <template v-else>{{ fret }}</template>
    </span>
    <button
      type="button"
      class="capo-stepper__btn"
      :aria-label="t('capo.ariaUp')"
      :disabled="fret >= 11"
      @click="shift(1)"
    >
      <AppIcon :name="icons.plus" size="1.25rem" />
    </button>
  </div>
</template>

<style scoped>
.capo-stepper {
  display: inline-flex;
  align-items: stretch;
  min-width: 8.5rem;
  min-height: 2.875rem;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: var(--app-surface);
  overflow: hidden;
}

.capo-stepper__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  flex-shrink: 0;
  border: 0;
  background: transparent;
  color: var(--app-accent-text);
  cursor: pointer;
  transition: background-color var(--app-duration) var(--app-ease);
}

.capo-stepper__btn:hover:not(:disabled) {
  background: var(--app-hover);
}

.capo-stepper__btn:active:not(:disabled) {
  background: var(--app-press);
}

.capo-stepper__btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.capo-stepper__value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-width: 2.75rem;
  padding: 0 0.35rem;
  border-inline: 1px solid var(--app-border);
  text-align: center;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: -0.02em;
  color: var(--app-ink);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.capo-stepper__value--none {
  color: var(--app-muted);
}
</style>
