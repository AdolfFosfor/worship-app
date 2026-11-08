<script setup lang="ts">
import { icons } from '~/utils/icons'

const workspace = useWorkspaceStore()
const { setlists, loading, error, fetchSetlists } = useSetlists()
const { syncSetlistsOnActivate } = useSetlistsRevision()

async function load(opts?: { quiet?: boolean }) {
  // quiet: KeepAlive-возврат — без полноэкранного лоадера
  if (opts?.quiet && setlists.value.length) {
    try {
      await fetchSetlists()
      markSetlistsSynced()
    } catch {
      /* ошибка уже в composable */
    }
    return
  }
  try {
    await fetchSetlists()
    markSetlistsSynced()
  } catch {
    /* ошибка уже в composable */
  }
}

const { markSetlistsSynced } = syncSetlistsOnActivate(() => load({ quiet: true }))

onMounted(() => {
  void load()
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

const nextUpcoming = computed(() => upcoming.value[0] ?? null)
const otherUpcoming = computed(() => upcoming.value.slice(1))

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
    <AppHeader title="Сет-листы">
      <template v-if="workspace.canEditSetlists" #trailing>
        <NuxtLink to="/setlists/new" class="app-header-action" aria-label="Создать сет-лист">
          <AppIcon :name="icons.add" size="1.65rem" />
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
      <section v-if="nextUpcoming" class="setlists-section">
        <h2 class="setlists-section__title">Ближайшее</h2>

        <NuxtLink :to="`/setlists/${nextUpcoming.id}`" class="setlists-hero">
          <span class="setlists-pill">{{ formatDatePill(nextUpcoming.serviceDate) }}</span>
          <span class="setlists-hero__title">{{ nextUpcoming.title }}</span>
          <AppIcon :name="icons.chevronRight" class="setlists-hero__chevron" size="1.15rem" />
        </NuxtLink>

        <div v-if="otherUpcoming.length" class="setlists-cards">
          <NuxtLink
            v-for="item in otherUpcoming"
            :key="item.id"
            :to="`/setlists/${item.id}`"
            class="setlists-card"
          >
            <span class="setlists-pill">{{ formatDatePill(item.serviceDate) }}</span>
            <span class="setlists-card__title">{{ item.title }}</span>
            <AppIcon :name="icons.chevronRight" class="setlists-card__chevron" size="1.05rem" />
          </NuxtLink>
        </div>
      </section>

      <section v-if="past.length" class="setlists-section">
        <h2 class="setlists-section__title">История</h2>
        <div class="setlists-cards">
          <NuxtLink
            v-for="item in past"
            :key="item.id"
            :to="`/setlists/${item.id}`"
            class="setlists-card setlists-card--past"
          >
            <span class="setlists-pill setlists-pill--muted">{{ formatDatePill(item.serviceDate) }}</span>
            <span class="setlists-card__title">{{ item.title }}</span>
            <AppIcon :name="icons.chevronRight" class="setlists-card__chevron" size="1.05rem" />
          </NuxtLink>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.setlists-section {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.setlists-section__title {
  margin: 0;
  font-size: var(--app-text-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--app-section-header);
}

.setlists-pill {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: 1.5rem;
  padding: 0 0.55rem;
  border-radius: 999px;
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
  font-size: var(--app-text-xs);
  font-weight: 700;
}

.setlists-pill--muted {
  background: var(--app-hover);
  color: var(--app-muted);
}

.setlists-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--app-space-2);
  min-height: 7rem;
  padding: var(--app-space-5);
  padding-right: 2.5rem;
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-left: 3px solid var(--app-accent);
  text-decoration: none;
  color: inherit;
}

.setlists-hero__title {
  font-size: var(--app-text-xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--app-ink);
}

.setlists-hero__chevron {
  position: absolute;
  right: var(--app-space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--app-muted);
}

.setlists-cards {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.setlists-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--app-space-2);
  min-height: 4.5rem;
  padding: var(--app-space-4);
  padding-right: 2.25rem;
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  text-decoration: none;
  color: inherit;
}

.setlists-card--past {
  opacity: 0.88;
}

.setlists-card__title {
  font-weight: 700;
  font-size: var(--app-text-md);
  letter-spacing: -0.01em;
  color: var(--app-ink);
  line-height: 1.25;
}

.setlists-card__chevron {
  position: absolute;
  right: var(--app-space-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--app-muted);
  opacity: 0.75;
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
