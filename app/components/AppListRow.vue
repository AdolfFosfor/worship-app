<script setup lang="ts">
import { icons } from '~/utils/icons'

defineProps<{
  title: string
  subtitle?: string
  meta?: string
  to?: string
  chevron?: boolean
}>()
</script>

<template>
  <NuxtLink v-if="to" :to="to" class="app-list-row">
    <div class="app-list-row__body">
      <div class="app-list-row__title">{{ title }}</div>
      <div v-if="subtitle" class="app-list-row__subtitle">{{ subtitle }}</div>
    </div>
    <div class="app-list-row__trailing">
      <slot name="trailing">
        <span v-if="meta" class="app-list-row__meta">{{ meta }}</span>
        <AppIcon v-if="chevron" :name="icons.chevronRight" class="app-list-row__chevron" />
      </slot>
    </div>
  </NuxtLink>
  <div v-else class="app-list-row">
    <div class="app-list-row__body">
      <div class="app-list-row__title">{{ title }}</div>
      <div v-if="subtitle" class="app-list-row__subtitle">{{ subtitle }}</div>
    </div>
    <div class="app-list-row__trailing">
      <slot name="trailing">
        <span v-if="meta" class="app-list-row__meta">{{ meta }}</span>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.app-list-row {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  min-height: 3.75rem;
  padding: var(--app-space-4) var(--app-space-4);
  background: var(--app-surface);
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid var(--app-border);
}

.app-list-row:active {
  background: var(--app-hover);
}

.app-list-row__body {
  flex: 1;
  min-width: 0;
}

.app-list-row__title {
  font-weight: 600;
  font-size: var(--app-text-lg);
  letter-spacing: -0.01em;
  line-height: 1.25;
  color: var(--app-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-list-row__subtitle {
  margin-top: 0.2rem;
  font-size: var(--app-text-sm);
  color: var(--app-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-list-row__trailing {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  flex-shrink: 0;
  color: var(--app-muted);
}

.app-list-row__meta {
  font-size: var(--app-text-md);
  font-weight: 700;
  color: var(--app-accent-text);
}

.app-list-row__chevron {
  width: 1.25rem;
  height: 1.25rem;
  opacity: 0.7;
}
</style>
