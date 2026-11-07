<script setup lang="ts">
import { icons } from '~/utils/icons'

const route = useRoute()

const tabs = [
  {
    to: '/',
    label: 'Главная',
    icon: icons.homeLinear,
    iconActive: icons.home,
    match: (path: string) => path === '/',
  },
  {
    to: '/songs',
    label: 'Песни',
    icon: icons.musicLinear,
    iconActive: icons.music,
    match: (path: string) => path.startsWith('/songs'),
  },
  {
    to: '/setlists',
    label: 'Сеты',
    icon: icons.playlistLinear,
    iconActive: icons.playlist,
    match: (path: string) => path.startsWith('/setlists'),
  },
  {
    to: '/members',
    label: 'Команда',
    icon: icons.usersLinear,
    iconActive: icons.users,
    match: (path: string) => path.startsWith('/members'),
  },
] as const
</script>

<template>
  <nav class="app-bottom-nav" aria-label="Основная навигация">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="app-bottom-nav__item"
      :class="{ 'app-bottom-nav__item--active': tab.match(route.path) }"
    >
      <AppIcon
        :name="tab.match(route.path) ? tab.iconActive : tab.icon"
        class="app-bottom-nav__icon"
      />
      <span class="app-bottom-nav__label">{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.app-bottom-nav {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  height: calc(var(--app-nav-height) + var(--app-safe-bottom));
  padding-bottom: var(--app-safe-bottom);
  background: var(--app-bottom-bar);
  border-top: 1px solid var(--app-border);
}

.app-bottom-nav__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  min-height: var(--app-touch-min);
  color: var(--app-muted);
  text-decoration: none;
  font-size: var(--app-text-xs);
  font-weight: 500;
  -webkit-tap-highlight-color: transparent;
}

.app-bottom-nav__item--active {
  color: var(--app-accent-text);
}

.app-bottom-nav__icon {
  width: 1.35rem;
  height: 1.35rem;
}

.app-bottom-nav__label {
  line-height: 1;
}
</style>
