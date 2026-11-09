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
  border-radius: var(--app-radius-lg);
  background: var(--app-surface);
  font-family:
    ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--app-text-sm);
  line-height: 1.55;
  letter-spacing: -0.01em;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--app-ink);
}
</style>
