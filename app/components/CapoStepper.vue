<script setup lang="ts">
import { icons } from '~/utils/icons'
import { clampCapo } from '~/utils/music/capo'

const props = defineProps<{
  modelValue: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function shift(delta: number) {
  emit('update:modelValue', clampCapo(props.modelValue + delta))
}

const label = computed(() => {
  const fret = clampCapo(props.modelValue)
  return fret === 0 ? 'без' : String(fret)
})
</script>

<template>
  <div class="capo-stepper">
    <button
      type="button"
      class="capo-stepper__btn"
      aria-label="Капо ниже"
      :disabled="clampCapo(modelValue) <= 0"
      @click="shift(-1)"
    >
      <AppIcon :name="icons.minus" />
    </button>
    <span class="capo-stepper__value">{{ label }}</span>
    <button
      type="button"
      class="capo-stepper__btn"
      aria-label="Капо выше"
      :disabled="clampCapo(modelValue) >= 11"
      @click="shift(1)"
    >
      <AppIcon :name="icons.plus" />
    </button>
  </div>
</template>

<style scoped>
.capo-stepper {
  display: inline-flex;
  align-items: center;
  gap: var(--app-space-2);
  padding: 0.2rem;
  border-radius: 999px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
}

.capo-stepper__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--app-accent-text);
  cursor: pointer;
}

.capo-stepper__btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.capo-stepper__value {
  min-width: 2.5rem;
  text-align: center;
  font-weight: 700;
  font-size: var(--app-text-md);
  color: var(--app-ink);
  font-variant-numeric: tabular-nums;
}
</style>
