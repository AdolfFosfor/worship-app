<script setup lang="ts">
import type Popover from 'primevue/popover'
import { icons, type AppIconName } from '~/utils/icons'

const workspace = useWorkspaceStore()
const { getUpcoming, upcoming } = useSetlists()
const { syncSetlistsOnActivate } = useSetlistsRevision()

const loading = ref(!upcoming.value)
const error = ref<string | null>(null)

const createPopover = useTemplateRef<InstanceType<typeof Popover>>('createPopover')

const canCreate = computed(
  () => workspace.canEditSongs || workspace.canEditSetlists,
)

const createOptions = computed(() => {
  const options: {
    to: string
    label: string
    icon: AppIconName
    kind: 'song' | 'setlist'
  }[] = []
  if (workspace.canEditSongs) {
    options.push({
      to: '/songs/new',
      label: 'Песня',
      icon: icons.music,
      kind: 'song',
    })
  }
  if (workspace.canEditSetlists) {
    options.push({
      to: '/setlists/new',
      label: 'Сет-лист',
      icon: icons.playlist,
      kind: 'setlist',
    })
  }
  return options
})

function toggleCreateMenu(event: Event) {
  createPopover.value?.toggle(event)
}

async function onCreatePick(to: string) {
  createPopover.value?.hide()
  await navigateTo(to)
}

async function load(opts?: { quiet?: boolean }) {
  if (!opts?.quiet && !upcoming.value) loading.value = true
  error.value = null
  try {
    await getUpcoming()
    markSetlistsSynced()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки'
  } finally {
    loading.value = false
  }
}

const { markSetlistsSynced } = syncSetlistsOnActivate(() => load({ quiet: true }))
onMounted(() => {
  void load()
})

function formatDatePill(iso: string) {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(new Date(iso + 'T12:00:00'))
  } catch {
    return iso
  }
}
</script>

<template>
  <div class="app-page">
    <AppHeader :title="workspace.workspace?.name ?? 'Worship'">
      <template v-if="canCreate" #trailing>
        <button
          type="button"
          class="app-header-action"
          aria-label="Создать"
          aria-haspopup="menu"
          @click="toggleCreateMenu"
        >
          <AppIcon :name="icons.add" />
        </button>
      </template>
    </AppHeader>

    <Popover ref="createPopover" class="app-create-popover">
      <div class="app-create-menu" role="menu" aria-label="Создать">
        <button
          v-for="option in createOptions"
          :key="option.kind"
          type="button"
          class="app-create-menu__item"
          :class="`app-create-menu__item--${option.kind}`"
          role="menuitem"
          @click="onCreatePick(option.to)"
        >
          <span class="app-create-menu__icon">
            <AppIcon :name="option.icon" :size="18" />
          </span>
          <span class="app-create-menu__label">{{ option.label }}</span>
        </button>
      </div>
    </Popover>

    <AppLoading v-if="loading" />
    <AppError v-else-if="error" :message="error" @retry="load" />

    <template v-else>
      <section class="home-section">
        <h2 class="home-section__title">Ближайшее служение</h2>

        <div class="home-hero">
          <template v-if="upcoming">
            <NuxtLink :to="`/setlists/${upcoming.id}`" class="home-hero__link">
              <span class="home-hero__badge">{{ formatDatePill(upcoming.serviceDate) }}</span>
              <h3 class="home-hero__title">{{ upcoming.title }}</h3>
              <AppIcon :name="icons.chevronRight" class="home-hero__chevron" size="1.15rem" />
            </NuxtLink>
            <div
              v-if="upcoming.items.length"
              class="home-hero__songs"
              aria-label="Песни в сет-листе"
            >
              <span
                v-for="item in upcoming.items"
                :key="item.id"
                class="home-hero__song-pill"
              >
                {{ item.song.title }}
              </span>
            </div>
          </template>
          <div v-else class="home-hero__empty">
            <AppEmptyState
              title="Пока нет служений"
              description="Создайте сет-лист на ближайшую дату"
            >
              <template v-if="workspace.canEditSetlists" #action>
                <NuxtLink to="/setlists/new" class="home-cta">Создать</NuxtLink>
              </template>
            </AppEmptyState>
          </div>
        </div>
      </section>

      <div class="home-actions">
        <NuxtLink to="/songs" class="home-action">
          <span class="home-action__icon-wrap">
            <AppIcon :name="icons.music" class="home-action__icon" />
          </span>
          <span class="home-action__label">Библиотека</span>
        </NuxtLink>
        <NuxtLink to="/setlists" class="home-action">
          <span class="home-action__icon-wrap">
            <AppIcon :name="icons.playlist" class="home-action__icon" />
          </span>
          <span class="home-action__label">Сет-листы</span>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
.home-section {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.home-section__title {
  margin: 0;
  font-size: var(--app-text-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--app-section-header);
}

.home-hero {
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-left: 3px solid var(--app-accent);
  overflow: hidden;
}

.home-hero__link {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--app-space-2);
  padding: var(--app-space-5);
  padding-bottom: var(--app-space-3);
  padding-right: 2.5rem;
  text-decoration: none;
  color: inherit;
}

.home-hero__badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.5rem;
  padding: 0 0.55rem;
  border-radius: 999px;
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
  font-size: var(--app-text-xs);
  font-weight: 700;
}

.home-hero__title {
  margin: 0;
  font-size: var(--app-text-xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--app-ink);
}

.home-hero__chevron {
  position: absolute;
  right: var(--app-space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--app-muted);
}

.home-hero__songs {
  display: flex;
  gap: var(--app-space-2);
  padding: 0 var(--app-space-5) var(--app-space-5);
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.home-hero__songs::-webkit-scrollbar {
  display: none;
}

.home-hero__song-pill {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  max-width: 12rem;
  min-height: 1.75rem;
  padding: 0 0.7rem;
  border-radius: 999px;
  background: var(--app-hover);
  color: var(--app-ink);
  font-size: var(--app-text-xs);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.home-hero__empty {
  padding: var(--app-space-2) 0;
}

.home-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--app-space-3);
}

.home-action {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--app-space-3);
  min-height: 5.5rem;
  padding: var(--app-space-4);
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  text-decoration: none;
  color: var(--app-ink);
}

.home-action__icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--app-radius-sm);
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
}

.home-action__icon {
  width: 1.25rem;
  height: 1.25rem;
}

.home-action__label {
  font-weight: 700;
}

.home-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.5rem;
  padding: 0 1rem;
  border-radius: var(--app-radius-sm);
  background: var(--app-accent);
  color: var(--app-accent-contrast);
  font-weight: 600;
  text-decoration: none;
}
</style>
