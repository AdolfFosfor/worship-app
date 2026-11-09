<script setup lang="ts">
import type { RepertoireActivityDay } from '~~/shared/types'
import { buildSparklineLevels } from '~/utils/repertoire/calendar'

const props = defineProps<{
  from: string
  to: string
  activity: RepertoireActivityDay[]
}>()

const levels = computed(() =>
  buildSparklineLevels(props.from, props.to, props.activity, 20),
)
</script>

<template>
  <div class="spark" aria-hidden="true">
    <span
      v-for="(level, i) in levels"
      :key="i"
      class="spark__bar"
      :class="`spark__bar--l${level}`"
    />
  </div>
</template>

<style scoped>
.spark {
  display: flex;
  align-items: flex-end;
  gap: 0.12rem;
  height: 1.1rem;
}

.spark__bar {
  width: 0.18rem;
  height: 0.28rem;
  border-radius: 0.06rem;
  background: color-mix(in srgb, var(--app-ink) 10%, transparent);
}

.spark__bar--l1 {
  height: 0.4rem;
  background: color-mix(in srgb, var(--app-accent) 35%, transparent);
}

.spark__bar--l2 {
  height: 0.55rem;
  background: color-mix(in srgb, var(--app-accent) 55%, transparent);
}

.spark__bar--l3 {
  height: 0.75rem;
  background: color-mix(in srgb, var(--app-accent) 72%, transparent);
}

.spark__bar--l4 {
  height: 1rem;
  background: color-mix(in srgb, var(--app-accent) 92%, transparent);
}
</style>
