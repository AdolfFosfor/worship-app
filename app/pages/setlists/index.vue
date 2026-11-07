<script setup lang="ts">
import type { Setlist } from '~~/shared/types'
import { icons } from '~/utils/icons'

const workspace = useWorkspaceStore()
const { setlists, loading, error, fetchSetlists } = useSetlists()

onMounted(() => {
  void fetchSetlists()
})

const today = new Date().toISOString().slice(0, 10)

const upcoming = computed(() =>
  setlists.value
    .filter((s) => s.serviceDate >= today)
    .slice()
    .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate)),
)

const past = computed(() =>
  setlists.value
    .filter((s) => s.serviceDate < today)
    .slice()
    .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate)),
)

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso + 'T12:00:00'))
  } catch {
    return iso
  }
}

function subtitle(s: Setlist) {
  return formatDate(s.serviceDate)
}
</script>

<template>
  <div class="app-page">
    <AppHeader title="Сет-листы">
      <template v-if="workspace.canEditSetlists" #trailing>
        <NuxtLink to="/setlists/new" class="setlists-add" aria-label="Создать сет-лист">
          <AppIcon :name="icons.add" />
        </NuxtLink>
      </template>
    </AppHeader>

    <AppLoading v-if="loading && !setlists.length" />
    <AppError v-else-if="error" :message="error" @retry="fetchSetlists" />
    <AppEmptyState
      v-else-if="!setlists.length"
      title="Нет сет-листов"
      description="Создайте служение и добавьте песни"
    >
      <template v-if="workspace.canEditSetlists" #action>
        <NuxtLink to="/setlists/new" class="setlists-empty-cta">Создать</NuxtLink>
      </template>
    </AppEmptyState>

    <template v-else>
      <section v-if="upcoming.length" class="setlists-section">
        <h2 class="setlists-section__title">Предстоящие</h2>
        <AppSurfaceList>
          <AppListRow
            v-for="item in upcoming"
            :key="item.id"
            :to="`/setlists/${item.id}`"
            :title="item.title"
            :subtitle="subtitle(item)"
            chevron
          />
        </AppSurfaceList>
      </section>

      <section v-if="past.length" class="setlists-section">
        <h2 class="setlists-section__title">История</h2>
        <AppSurfaceList>
          <AppListRow
            v-for="item in past"
            :key="item.id"
            :to="`/setlists/${item.id}`"
            :title="item.title"
            :subtitle="subtitle(item)"
            chevron
          />
        </AppSurfaceList>
      </section>
    </template>
  </div>
</template>

<style scoped>
.setlists-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  color: var(--app-accent-text);
}

.setlists-section {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.setlists-section__title {
  margin: 0;
  padding-inline: var(--app-space-1);
  font-size: var(--app-text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--app-section-header);
}

.setlists-empty-cta {
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
