<script setup lang="ts">
const {
  title,
  subtitle,
  customTitle,
  customSubtitle,
  visible,
  titleSize,
  typeMs,
  eraseMs,
} = useAppHeader()
const typed = useAppHeaderTyped()
const { displayed: typedTitle, isTyping } = useTypedText(title, () => ({
  typeMs: typeMs.value,
  eraseMs: eraseMs.value,
}))

watchEffect(() => {
  typed.value = {
    text: typedTitle.value,
    typing: isTyping.value,
  }
})
</script>

<template>
  <header
    v-show="visible"
    class="app-shell-header"
    :aria-hidden="visible ? undefined : 'true'"
  >
    <div class="app-header">
      <div class="app-header__text">
        <div data-app-header-title class="app-header__title-slot">
          <!--
            Typed прячется через :has(), только когда в слоте есть Teleport.
            Так не бывает пустого хедера при залипшем customTitle после KeepAlive.
          -->
          <h1
            class="app-header__title"
            :class="{ 'app-header__title--display': titleSize === 'display' }"
            :aria-label="title"
          >
            <span aria-hidden="true">{{ typedTitle }}</span>
            <span
              v-show="isTyping && !customTitle"
              class="app-header__title-caret"
              aria-hidden="true"
            />
          </h1>
        </div>
        <div data-app-header-subtitle class="app-header__subtitle-slot">
          <Transition name="header-subtitle">
            <p
              v-if="subtitle && !customSubtitle"
              :key="subtitle"
              class="app-header__subtitle"
            >
              {{ subtitle }}
            </p>
          </Transition>
        </div>
      </div>
      <div data-app-header-trailing class="app-header__trailing" />
    </div>
  </header>
</template>

<style scoped>
.app-shell-header {
  flex-shrink: 0;
  padding: 16px var(--app-page-inline) 0;
}

.app-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--app-space-2);
  min-height: 2.75rem;
}

.app-header__text {
  min-width: 0;
  overflow: hidden;
}

.app-header__title-slot,
.app-header__subtitle-slot {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.app-header__title-slot:has(> :not(.app-header__title)) .app-header__title {
  display: none;
}

.app-header__title {
  margin: 0;
  display: flex;
  align-items: center;
  width: fit-content;
  max-width: 100%;
  font-size: var(--app-text-2xl);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: var(--app-ink);
  white-space: nowrap;
  overflow: hidden;
}

.app-header__title > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* legacy: titleSize=display больше не используем для песен/сетов */
.app-header__title--display {
  font-size: var(--app-text-2xl);
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.app-header__title-caret {
  display: inline-block;
  width: 0.08em;
  height: 0.85em;
  margin-left: 0.06em;
  border-radius: 1px;
  background: color-mix(in srgb, var(--app-accent-text) 70%, transparent);
  animation: app-header-caret 1s steps(1) infinite;
  flex-shrink: 0;
}

.app-header__subtitle {
  margin: 0.15rem 0 0;
  font-size: var(--app-text-sm);
  font-weight: 500;
  color: var(--app-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-header__trailing {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--app-space-2);
  min-height: 2.5rem;
  flex-shrink: 0;
}

.header-subtitle-enter-active,
.header-subtitle-leave-active {
  transition:
    opacity 180ms var(--app-ease, ease),
    transform 180ms var(--app-ease, ease);
}

.header-subtitle-enter-from,
.header-subtitle-leave-to {
  opacity: 0;
  transform: translateY(-0.15rem);
}

@keyframes app-header-caret {
  0%,
  45% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-header__title-caret {
    display: none;
  }
}
</style>
