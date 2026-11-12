<script setup lang="ts">
import { icons } from '~/utils/icons'

const route = useRoute()
const { t } = useAppLocale()
const positions = useState<Record<string, number>>('app-shell-scroll', () => ({}))

const tabs = computed(() => [
  {
    to: '/',
    label: t('nav.home'),
    icon: icons.homeLinear,
    iconActive: icons.home,
    match: (path: string) => path === '/',
  },
  {
    to: '/songs',
    label: t('nav.songs'),
    icon: icons.musicLinear,
    iconActive: icons.music,
    match: (path: string) => path.startsWith('/songs'),
  },
  {
    to: '/setlists',
    label: t('nav.setlists'),
    icon: icons.playlistLinear,
    iconActive: icons.playlist,
    match: (path: string) => path.startsWith('/setlists'),
  },
  {
    to: '/account',
    label: t('nav.settings'),
    icon: icons.settingsLinear,
    iconActive: icons.settings,
    match: (path: string) => path.startsWith('/account') || path.startsWith('/members'),
  },
])

/** Повторный тап по активной вкладке — скролл наверх (как в iOS). */
function onTabClick(
  tab: { to: string; match: (path: string) => boolean },
  event: MouseEvent,
) {
  if (!tab.match(route.path)) return

  if (route.path === tab.to) {
    event.preventDefault()
    scrollShellToTop(tab.to)
    return
  }

  // Вложенный экран вкладки → корень вкладки с нуля
  positions.value[tab.to] = 0
}
</script>

<template>
  <nav class="app-bottom-nav" :aria-label="t('nav.ariaMain')">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="app-bottom-nav__item"
      :class="{ 'app-bottom-nav__item--active': tab.match(route.path) }"
      @click="onTabClick(tab, $event)"
    >
      <span class="app-bottom-nav__icon-wrap">
        <AppIcon
          :name="tab.match(route.path) ? tab.iconActive : tab.icon"
          class="app-bottom-nav__icon"
        />
      </span>
      <span class="app-bottom-nav__label">{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.app-bottom-nav {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  height: calc(var(--app-nav-height) + var(--app-safe-bottom));
  padding-bottom: var(--app-safe-bottom);
  background: color-mix(in srgb, var(--app-bottom-bar) 92%, transparent);
  border-top: var(--app-hairline) solid var(--app-border);
  backdrop-filter: saturate(180%) blur(16px);
  -webkit-backdrop-filter: saturate(180%) blur(16px);
}

.app-bottom-nav__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  min-height: var(--app-touch-min);
  color: var(--app-muted);
  text-decoration: none;
  font-size: var(--app-text-2xs);
  font-weight: 550;
  letter-spacing: -0.01em;
  -webkit-tap-highlight-color: transparent;
  transition: color var(--app-duration) var(--app-ease);
}

.app-bottom-nav__item--active {
  color: var(--app-accent-text);
}

.app-bottom-nav__icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 1.5rem;
}

.app-bottom-nav__icon {
  width: 1.4rem;
  height: 1.4rem;
  transition: transform var(--app-duration) var(--app-ease);
}

.app-bottom-nav__item--active .app-bottom-nav__icon {
  transform: scale(1.06);
}

.app-bottom-nav__label {
  line-height: 1;
}
</style>
