<script setup lang="ts">
import { icons } from '~/utils/icons'
import { transposeKeyLabel } from '~/utils/music/keys'

const { t } = useAppLocale()

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function shift(delta: number) {
  emit('update:modelValue', transposeKeyLabel(props.modelValue, delta))
}
</script>

<template>
  <div class="key-stepper">
    <button type="button" class="key-stepper__btn" :aria-label="t('keyStepper.ariaDown')" @click="shift(-1)">
      <AppIcon :name="icons.minus" />
    </button>
    <span class="key-stepper__value">{{ modelValue }}</span>
    <button type="button" class="key-stepper__btn" :aria-label="t('keyStepper.ariaUp')" @click="shift(1)">
      <AppIcon :name="icons.plus" />
    </button>
  </div>
</template>

<style scoped>
.key-stepper {
  display: inline-flex;
  align-items: center;
  gap: var(--app-space-1);
  padding: 0.15rem;
  border-radius: var(--app-radius-pill);
  background: var(--app-hover);
}

.key-stepper__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: transparent;
  color: var(--app-accent-text);
  cursor: pointer;
  transition:
    background-color var(--app-duration) var(--app-ease),
    transform var(--app-duration) var(--app-ease);
}

.key-stepper__btn:active {
  background: var(--app-press);
  transform: scale(0.94);
}

.key-stepper__value {
  min-width: 2.5rem;
  text-align: center;
  font-weight: 700;
  font-size: var(--app-text-md);
  letter-spacing: -0.02em;
  color: var(--app-ink);
}
</style>
