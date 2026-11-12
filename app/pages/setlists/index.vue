<script setup lang="ts">
import type { Setlist } from '~~/shared/types'
import { isDefaultSessionTitle } from '~~/shared/i18n/messages'
import {
  formatListDayParts,
  formatMonthYearHeading,
  monthKeyFromIso,
} from '~/utils/dates'
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

/** Пока нет кэша — не показываем пустой список. */
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

interface SetlistMonthGroup {
  key: string
  label: string
  items: Setlist[]
}

const monthGroups = computed((): SetlistMonthGroup[] => {
  const sorted = setlists.value
    .slice()
    .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))

  const groups: SetlistMonthGroup[] = []
  const indexByKey = new Map<string, number>()

  for (const item of sorted) {
    const key = monthKeyFromIso(item.serviceDate)
    let idx = indexByKey.get(key)
    if (idx == null) {
      idx = groups.length
      indexByKey.set(key, idx)
      groups.push({
        key,
        label: formatMonthYearHeading(item.serviceDate, locale.value),
        items: [],
      })
    }
    groups[idx]!.items.push(item)
  }

  return groups
})

const {
  limit: setlistsRevealLimit,
  hasMore: setlistsHasMore,
  sentinel: setlistsRevealSentinel,
} = useShellRevealWindow(() => setlists.value.length, {
  initial: 20,
  step: 20,
  estimateRowPx: 60,
})

/** Показываем месяцы/строки порциями — панель месяца остаётся целой. */
const visibleMonthGroups = computed((): SetlistMonthGroup[] => {
  let left = setlistsRevealLimit.value
  const out: SetlistMonthGroup[] = []
  for (const group of monthGroups.value) {
    if (left <= 0) break
    const items = group.items.slice(0, left)
    left -= items.length
    if (items.length) {
      out.push({
        key: group.key,
        label: group.label,
        items,
      })
    }
  }
  return out
})

async function load(opts?: { quiet?: boolean }) {
  if (!opts?.quiet && !setlists.value.length) {
    pageReady.value = false
  }
  try {
    await Promise.all([
      fetchSetlists({ quiet: opts?.quiet }),
      getUpcoming(),
    ])
    markSetlistsSynced()
  } catch {
    /* ошибка уже в composable */
  } finally {
    pageReady.value = true
  }
}

const { markSetlistsSynced } = syncSetlistsOnActivate(() => load({ quiet: true }))
useAppPullRefresh(() => load({ quiet: true }))

onMounted(() => {
  void load()
  consumeCreateQuery()
})

watch(
  () => route.query.create,
  () => consumeCreateQuery(),
)

function dayParts(iso: string) {
  return formatListDayParts(iso, locale.value)
}

function isEvent(item: Setlist) {
  return !isDefaultSessionTitle(item.title)
}

function songsCountLabel(count: number) {
  const n = Math.max(0, count)
  const mod10 = n % 10
  const mod100 = n % 100
  let form: 'one' | 'few' | 'many' = 'many'
  if (locale.value === 'en' || locale.value === 'ro') {
    form = n === 1 ? 'one' : 'many'
  } else if (mod10 === 1 && mod100 !== 11) {
    form = 'one'
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    form = 'few'
  }
  return t(`setlists.songsCount_${form}`, { count: n })
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

useAppHeader(() => ({
  title: t('setlists.title'),
}))
</script>

<template>
  <div class="app-page">
    <AppHeaderTrailing>
      <button
        v-if="workspace.canEditSetlists"
        key="create"
        type="button"
        class="app-header-action"
        :aria-label="t('setlists.ariaCreate')"
        @click="openCreate"
      >
        <AppIcon :name="icons.add" />
      </button>
    </AppHeaderTrailing>

    <CreateSetlistSheet ref="createSheet" v-model:open="createOpen" />

    <template v-if="!pageReady || (loading && !setlists.length)">
      <section class="app-section setlists-group">
        <AppSkeleton variant="line" width="5.5rem" height="0.7rem" class="setlists-sk-label" />
        <SkeletonListRows :rows="5" with-date />
      </section>
    </template>
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
      <section
        v-for="group in visibleMonthGroups"
        :key="group.key"
        class="app-section setlists-group"
      >
        <h2 class="setlists-group__title">{{ group.label }}</h2>
        <div class="setlists-month app-panel">
          <SwipeDeleteRow
            v-for="item in group.items"
            :key="item.id"
            class="setlists-row-swipe"
            :disabled="!workspace.canEditSetlists"
            @commit="confirmDeleteSetlist(item)"
          >
            <NuxtLink
              :to="`/setlists/${item.id}`"
              class="setlists-row app-press"
            >
              <div class="setlists-row__date" aria-hidden="true">
                <span class="setlists-row__weekday">{{ dayParts(item.serviceDate).weekday }}</span>
                <span class="setlists-row__day">{{ dayParts(item.serviceDate).day }}</span>
              </div>
              <div class="setlists-row__main">
                <div class="setlists-row__title-line">
                  <span class="setlists-row__title">{{ sessionTitle(item.title) }}</span>
                  <span v-if="isEvent(item)" class="setlists-row__event">
                    {{ t('setlists.eventBadge') }}
                  </span>
                </div>
                <span class="setlists-row__meta">
                  {{ songsCountLabel(item.itemCount ?? 0) }}
                </span>
              </div>
              <AppIcon
                :name="icons.chevronRight"
                class="setlists-row__chevron"
                size="1.05rem"
              />
            </NuxtLink>
          </SwipeDeleteRow>
        </div>
      </section>
      <div
        v-if="setlistsHasMore"
        ref="setlistsRevealSentinel"
        class="app-reveal-sentinel"
        aria-hidden="true"
      />
    </template>
  </div>
</template>

<style scoped>
.setlists-group__title {
  margin: 0;
  padding-inline: var(--app-space-1);
  font-size: var(--app-text-sm);
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 1.25;
  color: var(--app-section-header);
}

.setlists-sk-label {
  margin-inline: var(--app-space-1);
}

.setlists-month {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.setlists-row-swipe:not(:last-child) :deep(.swipe-delete__content)::after {
  content: '';
  position: absolute;
  left: 3.05rem;
  right: 0;
  bottom: 0;
  height: var(--app-hairline, 1px);
  background: var(--app-border);
  pointer-events: none;
}

.setlists-row {
  display: grid;
  grid-template-columns: 2.15rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
  min-height: 3.35rem;
  padding: 0.55rem var(--app-page-inline) 0.55rem 0.55rem;
  text-decoration: none;
  color: inherit;
}

.setlists-row__date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.05rem;
  min-width: 0;
  line-height: 1.05;
}

.setlists-row__weekday {
  font-size: var(--app-text-2xs);
  font-weight: 650;
  letter-spacing: -0.01em;
  text-transform: lowercase;
  color: var(--app-muted);
}

.setlists-row__day {
  font-size: var(--app-text-lg);
  font-weight: 750;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: var(--app-ink);
}

.setlists-row__main {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
}

.setlists-row__title-line {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.setlists-row__title {
  min-width: 0;
  font-size: var(--app-text-md);
  font-weight: 650;
  letter-spacing: -0.015em;
  line-height: 1.25;
  color: var(--app-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.setlists-row__event {
  flex-shrink: 0;
  padding: 0.12rem 0.4rem;
  border-radius: var(--app-radius-pill);
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1.2;
}

.setlists-row__meta {
  font-size: var(--app-text-xs);
  font-weight: 550;
  color: var(--app-muted);
  font-variant-numeric: tabular-nums;
}

.setlists-row__chevron {
  flex-shrink: 0;
  color: var(--app-muted);
  opacity: 0.45;
}
</style>
