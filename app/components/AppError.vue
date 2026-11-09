<script setup lang="ts">
defineProps<{
  message?: string
}>()

defineEmits<{
  retry: []
}>()

const { t } = useAppLocale()
</script>

<template>
  <div class="app-error" role="alert">
    <p class="app-error__message">{{ message ?? t('common.genericError') }}</p>
    <Button
      :label="t('common.retry')"
      severity="secondary"
      size="small"
      @click="$emit('retry')"
    />
  </div>
</template>

<style scoped>
.app-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--app-space-3);
  padding: var(--app-space-6) var(--app-space-4);
  text-align: center;
}

.app-error__message {
  margin: 0;
  color: var(--app-destructive);
  font-size: var(--app-text-sm);
}
</style>
