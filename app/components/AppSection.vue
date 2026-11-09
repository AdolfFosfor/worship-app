<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <section class="app-section">
    <h2 v-if="title" class="app-section__title">{{ title }}</h2>
    <slot />
  </section>
</template>
