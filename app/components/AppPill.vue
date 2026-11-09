<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'accent' | 'muted' | 'soft'
    size?: 'sm' | 'md'
  }>(),
  {
    tone: 'accent',
    size: 'md',
  },
)
</script>

<template>
  <span
    class="app-pill"
    :class="{
      'app-pill--muted': tone === 'muted',
      'app-pill--soft': tone === 'soft',
      'app-pill--sm': size === 'sm',
    }"
  >
    <slot />
  </span>
</template>
