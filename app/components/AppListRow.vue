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
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  min-height: 3.5rem;
  padding: 0.85rem var(--app-space-4);
  background: transparent;
  color: inherit;
  text-decoration: none;
  transition: background-color var(--app-duration) var(--app-ease);
}

.app-list-row:active {
  background: var(--app-hover);
}

.app-list-row:not(:last-child)::after {
  content: '';
  position: absolute;
  left: var(--app-space-4);
  right: 0;
  bottom: 0;
  height: var(--app-hairline);
  background: var(--app-border);
  pointer-events: none;
}

.app-list-row__body {
  flex: 1;
  min-width: 0;
}

.app-list-row__title {
  font-weight: 600;
  font-size: var(--app-text-lg);
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--app-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-list-row__subtitle {
  margin-top: 0.15rem;
  font-size: var(--app-text-sm);
  font-weight: 450;
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
  display: inline-flex;
  align-items: center;
  min-height: 1.5rem;
  padding: 0 0.55rem;
  border-radius: var(--app-radius-pill);
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
  font-size: var(--app-text-xs);
  font-weight: 700;
  letter-spacing: -0.01em;
}

.app-list-row__chevron {
  width: 1.05rem;
  height: 1.05rem;
  opacity: 0.45;
}
</style>
