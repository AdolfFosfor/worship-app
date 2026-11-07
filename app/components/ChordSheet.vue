<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>

<template>
  <pre class="chord-sheet">{{ text }}</pre>
</template>

<style scoped>
.chord-sheet {
  margin: 0;
  padding: var(--app-space-4);
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--app-text-sm);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--app-ink);
}
</style>
