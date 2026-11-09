<script setup lang="ts">
import type { Setlist } from '~~/shared/types'
import { formatServiceDatePill, localTodayKey } from '~/utils/dates'
import { icons } from '~/utils/icons'

const route = useRoute()
const workspace = useWorkspaceStore()
const { t, sessionTitle, locale } = useAppLocale()
const {
  setlists,
  loading,
  error,
  fetchSetlists,
  getUpcoming,
  upcoming,
  deleteSetlist,
} = useSetlists()
const { syncSetlistsOnActivate } = useSetlistsRevision()
const toast = useToast()
const { requireDanger } = useAppConfirm()

/** Пока нет кэша — не показываем hero без пиллов. */
const pageReady = ref(Boolean(setlists.value.length || upcoming.value))
const createOpen = ref(false)
const createSheet = ref<{ open: () => void } | null>(null)

function openCreate() {
  createSheet.value?.open()
}

function consumeCreateQuery() {
  if (route.query.create == null) return
  if (workspace.canEditSetlists) createOpen.value = true
  void navigateTo({ path: '/setlists', query: {} }, { replace: true })
}

const today = computed(() => localTodayKey())

const upcomingList = computed(() =>
  setlists.value
    .filter((s) => s.serviceDate >= today.value)
    .slice()
    .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate)),
)

const past = computed(() =>
  setlists.value
    .filter((s) => s.serviceDate < today.value)
    .slice()
    .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate)),
)

const nextUpcoming = computed(() => upcomingList.value[0] ?? null)
const otherUpcoming = computed(() => upcomingList.value.slice(1))

const heroItems = computed(() => {
  const next = nextUpcoming.value
  const cached = upcoming.value
  if (!next || !cached || cached.id !== next.id) return []
  return cached.items
})

async function load(opts?: { quiet?: boolean }) {
  // quiet: KeepAlive-возврат — без полноэкранного лоадера, пиллы не сбрасываем
  if (!opts?.quiet && !setlists.value.length) {
    pageReady.value = false
  }
  try {
    await Promise.all([fetchSetlists(), getUpcoming()])
    markSetlistsSynced()
  } catch {
    /* ошибка уже в composable */
  } finally {
    pageReady.value = true
  }
}

const { markSetlistsSynced } = syncSetlistsOnActivate(() => load({ quiet: true }))

onMounted(() => {
  void load()
  consumeCreateQuery()
})

watch(
  () => route.query.create,
  () => consumeCreateQuery(),
)

function formatDatePill(iso: string) {
  return formatServiceDatePill(iso, {
    locale: locale.value,
    todayPrefix: (date) => t('dates.todayPrefix', { date }),
  })
}

function confirmDeleteSetlist(item: Setlist) {
  if (!workspace.canEditSetlists) return
  requireDanger({
    title: t('setlist.deleteConfirmTitle'),
    message: t('setlist.deleteConfirmMessage'),
    acceptLabel: t('common.delete'),
    accept: async () => {
      try {
        await deleteSetlist(item.id)
        if (upcoming.value?.id === item.id) {
          await getUpcoming()
        }
      } catch (e) {
        toast.add({
          severity: 'error',
          summary: t('common.error'),
          detail: e instanceof Error ? e.message : t('common.deleteFailed'),
          life: 4000,
        })
      }
    },
  })
}
</script>

<template>
  <div class="app-page">
    <AppHeader :title="t('setlists.title')">
      <template v-if="workspace.canEditSetlists" #trailing>
        <button
          type="button"
          class="app-header-action"
          :aria-label="t('setlists.ariaCreate')"
          @click="openCreate"
        >
          <AppIcon :name="icons.add" />
        </button>
      </template>
    </AppHeader>

    <CreateSetlistSheet ref="createSheet" v-model:open="createOpen" />

    <AppLoading v-if="!pageReady || (loading && !setlists.length)" />
    <AppError v-else-if="error" :message="error" @retry="load" />
    <AppEmptyState
      v-else-if="!setlists.length"
      :title="t('setlists.emptyTitle')"
      :description="t('setlists.emptyDesc')"
    >
      <template v-if="workspace.canEditSetlists" #action>
        <button type="button" class="app-cta" @click="openCreate">
          <AppIcon :name="icons.add" size="1.1rem" />
          {{ t('common.create') }}
        </button>
      </template>
    </AppEmptyState>

    <template v-else>
      <AppSection v-if="nextUpcoming" :title="t('setlists.sectionNext')">
        <SwipeDeleteRow
          class="setlists-hero-swipe"
          :disabled="!workspace.canEditSetlists"
          @commit="confirmDeleteSetlist(nextUpcoming)"
        >
          <div class="setlists-hero app-panel app-panel--accent">
            <NuxtLink :to="`/setlists/${nextUpcoming.id}`" class="setlists-hero__link app-press">
              <AppPill>{{ formatDatePill(nextUpcoming.serviceDate) }}</AppPill>
              <span class="setlists-hero__title">{{ sessionTitle(nextUpcoming.title) }}</span>
              <AppIcon :name="icons.chevronRight" class="setlists-hero__chevron" size="1.05rem" />
            </NuxtLink>
            <div
              v-if="heroItems.length"
              class="setlists-hero__songs app-chip-row"
              :aria-label="t('home.ariaSetlistSongs')"
            >
              <AppPill
                v-for="item in heroItems"
                :key="item.id"
                tone="soft"
              >
                {{ item.song.title }}
              </AppPill>
            </div>
          </div>
        </SwipeDeleteRow>

        <div v-if="otherUpcoming.length" class="setlists-stack">
          <SwipeDeleteRow
            v-for="item in otherUpcoming"
            :key="item.id"
            class="setlists-card-swipe"
            :disabled="!workspace.canEditSetlists"
            @commit="confirmDeleteSetlist(item)"
          >
            <NuxtLink
              :to="`/setlists/${item.id}`"
              class="setlists-card app-press"
            >
              <AppPill size="sm">{{ formatDatePill(item.serviceDate) }}</AppPill>
              <span class="setlists-card__title">{{ sessionTitle(item.title) }}</span>
              <AppIcon :name="icons.chevronRight" class="setlists-card__chevron" size="1rem" />
            </NuxtLink>
          </SwipeDeleteRow>
        </div>
      </AppSection>

      <AppSection v-if="past.length" :title="t('setlists.sectionHistory')">
        <div class="setlists-stack">
          <SwipeDeleteRow
            v-for="item in past"
            :key="item.id"
            class="setlists-card-swipe"
            :disabled="!workspace.canEditSetlists"
            @commit="confirmDeleteSetlist(item)"
          >
            <NuxtLink
              :to="`/setlists/${item.id}`"
              class="setlists-card setlists-card--past app-press"
            >
              <AppPill tone="muted" size="sm">{{ formatDatePill(item.serviceDate) }}</AppPill>
              <span class="setlists-card__title">{{ sessionTitle(item.title) }}</span>
              <AppIcon :name="icons.chevronRight" class="setlists-card__chevron" size="1rem" />
            </NuxtLink>
          </SwipeDeleteRow>
        </div>
      </AppSection>
    </template>
  </div>
</template>

<style scoped>
.setlists-hero-swipe,
.setlists-card-swipe {
  border-radius: var(--app-radius-lg);
}

.setlists-hero {
  overflow: hidden;
  background: var(--app-surface);
}

.setlists-hero__link {
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

.setlists-hero__title {
  font-size: var(--app-text-xl);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.2;
  color: var(--app-ink);
}

.setlists-hero__chevron {
  position: absolute;
  right: var(--app-space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--app-muted);
  opacity: 0.5;
}

.setlists-hero__songs {
  padding: 0 var(--app-space-5) var(--app-space-5);
}

.setlists-stack {
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
  min-height: 4.25rem;
  padding: var(--app-space-4);
  padding-right: 2.25rem;
  border-radius: var(--app-radius-lg);
  background: var(--app-surface);
  text-decoration: none;
  color: inherit;
}

.setlists-card--past {
  opacity: 0.82;
}

.setlists-card__title {
  font-weight: 650;
  font-size: var(--app-text-md);
  letter-spacing: -0.015em;
  color: var(--app-ink);
  line-height: 1.25;
}

.setlists-card__chevron {
  position: absolute;
  right: var(--app-space-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--app-muted);
  opacity: 0.45;
}
</style>
