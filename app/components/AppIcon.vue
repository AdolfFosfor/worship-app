<script setup lang="ts">
import { Icon } from '@iconify/vue'

const props = withDefaults(
  defineProps<{
    /** Имя Solar без префикса (`add-bold`) или полный id (`solar:add-bold`) */
    name: string
    size?: string | number
  }>(),
  {
    size: '1.125em',
  },
)

const icon = computed(() => (props.name.includes(':') ? props.name : `solar:${props.name}`))
</script>

<template>
  <Icon
    :icon="icon"
    :width="size"
    :height="size"
    class="app-icon"
    aria-hidden="true"
  />
</template>

<style scoped>
.app-icon {
  display: block;
  flex-shrink: 0;
}
</style>
