<script setup lang="ts">
import { icons } from '~/utils/icons'
import { transposeKeyLabel } from '~/utils/music/keys'

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
    <button type="button" class="key-stepper__btn" aria-label="Ниже" @click="shift(-1)">
      <AppIcon :name="icons.minus" />
    </button>
    <span class="key-stepper__value">{{ modelValue }}</span>
    <button type="button" class="key-stepper__btn" aria-label="Выше" @click="shift(1)">
      <AppIcon :name="icons.plus" />
    </button>
  </div>
</template>

<style scoped>
.key-stepper {
  display: inline-flex;
  align-items: center;
  gap: var(--app-space-2);
  padding: 0.2rem;
  border-radius: 999px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
}

.key-stepper__btn {
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

.key-stepper__value {
  min-width: 2.5rem;
  text-align: center;
  font-weight: 700;
  font-size: var(--app-text-md);
  color: var(--app-ink);
}
</style>
