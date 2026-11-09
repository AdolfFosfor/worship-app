<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header class="app-header">
    <div class="app-header__text">
      <h1 class="app-header__title">{{ title }}</h1>
      <p v-if="subtitle" class="app-header__subtitle">{{ subtitle }}</p>
    </div>
    <div class="app-header__trailing">
      <slot name="trailing" />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--app-space-2);
  min-height: 2.75rem;
}

.app-header__text {
  min-width: 0;
}

.app-header__title {
  margin: 0;
  font-size: var(--app-text-2xl);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: var(--app-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-header__subtitle {
  margin: 0.15rem 0 0;
  font-size: var(--app-text-sm);
  font-weight: 500;
  color: var(--app-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-header__trailing {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  justify-content: flex-end;
}
</style>
