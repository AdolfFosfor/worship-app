<script setup lang="ts">
/**
 * Лёгкая личная заметка: muted строка под заголовком секции / трека.
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
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-muted);
  font: inherit;
  font-size: var(--app-text-xs);
  font-weight: 550;
  font-style: italic;
  letter-spacing: -0.01em;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.personal-note-cue:disabled {
  cursor: default;
}

.personal-note-cue--empty {
  opacity: 0.72;
}

.personal-note-cue__text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
}
</style>
