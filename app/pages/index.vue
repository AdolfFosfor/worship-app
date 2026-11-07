<script setup lang="ts">
import type { Setlist } from '~~/shared/types'
import { icons } from '~/utils/icons'

const workspace = useWorkspaceStore()
const { getUpcoming } = useSetlists()

const upcoming = ref<Setlist | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    upcoming.value = await getUpcoming()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    }).format(new Date(iso + 'T12:00:00'))
  } catch {
    return iso
  }
}
</script>

<template>
  <div class="app-page">
    <AppHeader
      :title="workspace.workspace?.name ?? 'Worship'"
      :subtitle="workspace.membership?.displayName ?? undefined"
    >
      <template #trailing>
        <NuxtLink to="/account" class="app-header-action" aria-label="Аккаунт">
          <AppIcon :name="icons.settings" size="1.55rem" />
        </NuxtLink>
      </template>
    </AppHeader>

    <AppLoading v-if="loading" />
    <AppError v-else-if="error" :message="error" @retry="load" />

    <template v-else>
      <section class="home-card">
        <p class="home-card__label">Ближайшее служение</p>
        <template v-if="upcoming">
          <NuxtLink :to="`/setlists/${upcoming.id}`" class="home-card__link">
            <h2 class="home-card__title">{{ upcoming.title }}</h2>
            <p class="home-card__date">{{ formatDate(upcoming.serviceDate) }}</p>
          </NuxtLink>
        </template>
        <AppEmptyState
          v-else
          title="Пока нет служений"
          description="Создайте сет-лист на ближайшую дату"
        >
          <template v-if="workspace.canEditSetlists" #action>
            <NuxtLink to="/setlists/new" class="home-cta">Создать сет-лист</NuxtLink>
          </template>
        </AppEmptyState>
      </section>

      <div class="home-actions">
        <NuxtLink to="/songs" class="home-action">
          <AppIcon :name="icons.music" class="home-action__icon" />
          <span>Библиотека</span>
        </NuxtLink>
        <NuxtLink to="/setlists" class="home-action">
          <AppIcon :name="icons.playlist" class="home-action__icon" />
          <span>Сет-листы</span>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
.home-card {
  padding: var(--app-space-5);
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  min-height: 8rem;
}

.home-card__label {
  margin: 0 0 var(--app-space-3);
  font-size: var(--app-text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--app-section-header);
}

.home-card__link {
  display: block;
  text-decoration: none;
  color: inherit;
}

.home-card__title {
  margin: 0;
  font-size: var(--app-text-xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--app-ink);
}

.home-card__date {
  margin: var(--app-space-2) 0 0;
  color: var(--app-accent-text);
  font-weight: 600;
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
  font-weight: 600;
}

.home-action__icon {
  width: 1.5rem;
  height: 1.5rem;
  color: var(--app-accent-text);
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
