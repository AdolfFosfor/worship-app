<script setup lang="ts">
/**
 * Лёгкая личная заметка: chip в духе app-fact, без пестроты.
 * Не путать с shared chart annotations.
 */
defineProps<{
  text?: string | null
  emptyLabel: string
  /** false — скрыть пустой cue (например, нет членства) */
  interactive?: boolean
}>()

defineEmits<{
  edit: []
}>()
</script>

<template>
  <button
    v-if="interactive || text"
    type="button"
    class="personal-note-cue"
    :class="{ 'personal-note-cue--empty': !text }"
    :disabled="interactive === false"
    @click.stop="$emit('edit')"
  >
    <span class="personal-note-cue__text">{{ text || emptyLabel }}</span>
  </button>
</template>

<style scoped>
.personal-note-cue {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 1.85rem;
  margin: 0;
  padding: 0 0.7rem;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: color-mix(in srgb, var(--app-ink) 6%, transparent);
  color: var(--app-muted);
  font: inherit;
  font-size: var(--app-text-xs);
  font-weight: 650;
  letter-spacing: -0.015em;
  line-height: 1.2;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color var(--app-duration) var(--app-ease),
    color var(--app-duration) var(--app-ease),
    transform var(--app-duration) var(--app-ease);
}

.personal-note-cue:not(:disabled):active {
  background: color-mix(in srgb, var(--app-ink) 10%, transparent);
  transform: scale(0.98);
}

.personal-note-cue:disabled {
  cursor: default;
}

.personal-note-cue:not(.personal-note-cue--empty) {
  color: color-mix(in srgb, var(--app-ink) 78%, var(--app-muted));
  background: color-mix(in srgb, var(--app-ink) 8%, transparent);
}

.personal-note-cue--empty {
  color: var(--app-faint);
  background: color-mix(in srgb, var(--app-ink) 4.5%, transparent);
  font-weight: 600;
}

.personal-note-cue__text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: auto 0;
  white-space: pre-wrap;
}
</style>
