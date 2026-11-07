<script setup lang="ts">
import { icons } from '~/utils/icons'

const props = defineProps<{
  title: string
  subtitle?: string
  backTo?: string
  showBack?: boolean
}>()

const emit = defineEmits<{
  back: []
}>()

const slots = useSlots()
const router = useRouter()

const hasBack = computed(
  () => Boolean(slots.leading) || props.showBack || props.backTo !== undefined,
)

function onBack() {
  emit('back')
  if (props.backTo) {
    void router.push(props.backTo)
    return
  }
  if (import.meta.client && window.history.length > 1) {
    router.back()
    return
  }
  void router.push('/')
}
</script>

<template>
  <header class="app-header" :class="{ 'app-header--with-back': hasBack }">
    <button
      v-if="hasBack"
      type="button"
      class="app-header__icon-btn"
      aria-label="Назад"
      @click="onBack"
    >
      <slot name="leading">
        <AppIcon :name="icons.arrowLeft" size="1.45rem" />
      </slot>
    </button>
    <div class="app-header__text">
      <h1 class="app-header__title">{{ title }}</h1>
      <p v-if="subtitle" class="app-header__subtitle">{{ subtitle }}</p>
    </div>
    <div class="app-header__trailing">
      <slot name="trailing" />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--app-space-2);
  min-height: 2.75rem;
}

.app-header--with-back {
  grid-template-columns: 2.75rem 1fr auto;
}

.app-header__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  margin-left: -0.4rem;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-accent-text);
  cursor: pointer;
}

.app-header__text {
  min-width: 0;
}

.app-header__title {
  margin: 0;
  font-size: var(--app-text-xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--app-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-header__subtitle {
  margin: 0.1rem 0 0;
  font-size: var(--app-text-sm);
  color: var(--app-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-header__trailing {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  justify-content: flex-end;
}
</style>
