<script setup lang="ts">
import Sortable from 'sortablejs'
import type { SetlistItemWithSong, SetlistWithItems, Song } from '~~/shared/types'
import { icons } from '~/utils/icons'
import { soundingKey } from '~/utils/music/capo'

const route = useRoute()
const workspace = useWorkspaceStore()
const { t, sessionTitle, locale } = useAppLocale()
const {
  getSetlist,
  deleteSetlist,
  addSongToSetlist,
  removeItem,
  reorderItems,
} = useSetlists()
const { syncSetlistsOnActivate } = useSetlistsRevision()
const { fetchSongs, songs } = useSongs()
const toast = useToast()
const { requireDanger } = useAppConfirm()

const id = computed(() => String(route.params.id))
const setlist = ref<SetlistWithItems | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const pickerVisible = ref(false)
const busy = ref(false)
const listEl = ref<HTMLElement | null>(null)

let sortable: Sortable | null = null

async function load(opts?: { quiet?: boolean }) {
  if (!opts?.quiet) loading.value = true
  error.value = null
  try {
    setlist.value = await getSetlist(id.value)
    markSetlistsSynced()
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('common.notFound')
  } finally {
    loading.value = false
  }
}

const { markSetlistsSynced } = syncSetlistsOnActivate(() => load({ quiet: true }))
onMounted(() => {
  void load()
})

function effectiveKey(item: SetlistItemWithSong) {
  return item.key ?? item.song.key
}

function songKeyLabel(item: SetlistItemWithSong) {
  if (item.key) return item.key
  return soundingKey(item.song.key, item.song.capo)
}

const DATE_LOCALE: Record<string, string> = {
  ru: 'ru-RU',
  ro: 'ro-RO',
  en: 'en-GB',
}

function formatDate(iso: string) {
  const tag = DATE_LOCALE[locale.value] ?? 'en-GB'
  try {
    return new Intl.DateTimeFormat(tag, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(iso + 'T12:00:00'))
  } catch {
    return iso
  }
}

async function openPicker() {
  await fetchSongs()
  pickerVisible.value = true
}

async function pickSong(song: Song) {
  busy.value = true
  try {
    const item = await addSongToSetlist(id.value, song.id)
    if (setlist.value) {
      setlist.value = {
        ...setlist.value,
        items: [...setlist.value.items, item],
      }
    }
    pickerVisible.value = false
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: e instanceof Error ? e.message : t('common.addFailed'),
      life: 4000,
    })
  } finally {
    busy.value = false
  }
}

async function persistOrder(orderedIds: string[]) {
  if (!setlist.value) return
  const byId = new Map(setlist.value.items.map((item) => [item.id, item]))
  const next = orderedIds
    .map((itemId) => byId.get(itemId))
    .filter((item): item is SetlistItemWithSong => Boolean(item))
  if (next.length !== setlist.value.items.length) return

  setlist.value = { ...setlist.value, items: next }
  try {
    await reorderItems(id.value, orderedIds)
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: e instanceof Error ? e.message : t('setlist.reorderFailed'),
      life: 4000,
    })
    await load()
  }
}

function destroySortable() {
  sortable?.destroy()
  sortable = null
}

function setupSortable() {
  destroySortable()
  if (!import.meta.client || !listEl.value || !workspace.canEditSetlists) return
  if (!setlist.value?.items.length) return

  sortable = Sortable.create(listEl.value, {
    animation: 180,
    handle: '.setlist-item__handle',
    draggable: '.setlist-item',
    ghostClass: 'setlist-item--ghost',
    chosenClass: 'setlist-item--chosen',
    dragClass: 'setlist-item--drag',
    forceFallback: true,
    fallbackTolerance: 4,
    onEnd: (evt) => {
      if (evt.oldIndex == null || evt.newIndex == null || evt.oldIndex === evt.newIndex) return
      if (!setlist.value) return
      const orderedIds = Array.from(listEl.value?.querySelectorAll<HTMLElement>('.setlist-item') ?? [])
        .map((el) => el.dataset.itemId)
        .filter((itemId): itemId is string => Boolean(itemId))
      void persistOrder(orderedIds)
    },
  })
}

watch(
  [listEl, () => setlist.value?.items.map((i) => i.id).join(','), () => workspace.canEditSetlists],
  async () => {
    await nextTick()
    setupSortable()
  },
)

onBeforeUnmount(destroySortable)

async function remove(item: SetlistItemWithSong) {
  try {
    await removeItem(item.id)
    if (setlist.value) {
      setlist.value = {
        ...setlist.value,
        items: setlist.value.items.filter((i) => i.id !== item.id),
      }
    }
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: e instanceof Error ? e.message : t('common.deleteFailed'),
      life: 4000,
    })
  }
}

function confirmDelete() {
  requireDanger({
    title: t('setlist.deleteConfirmTitle'),
    message: t('setlist.deleteConfirmMessage'),
    acceptLabel: t('common.delete'),
    accept: async () => {
      try {
        await deleteSetlist(id.value)
        await navigateTo('/setlists')
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

const availableSongs = computed(() => {
  const used = new Set(setlist.value?.items.map((i) => i.songId) ?? [])
  return songs.value.filter((s) => !used.has(s.id))
})
</script>

<template>
  <div class="app-page">
    <AppLoading v-if="loading" />
    <AppError v-else-if="error" :message="error" @retry="load" />
    <template v-else-if="setlist">
      <AppHeader
        :title="sessionTitle(setlist.title)"
        :subtitle="formatDate(setlist.serviceDate)"
      />

      <AppEmptyState
        v-if="!setlist.items.length"
        :title="t('setlist.emptySongsTitle')"
        :description="t('setlist.emptySongsDesc')"
      />

      <div v-else ref="listEl" class="setlist-items app-panel">
        <article
          v-for="(item, index) in setlist.items"
          :key="item.id"
          class="setlist-item"
          :data-item-id="item.id"
        >
          <button
            v-if="workspace.canEditSetlists"
            type="button"
            class="setlist-item__handle"
            :aria-label="t('setlist.ariaDrag')"
          >
            <AppIcon :name="icons.grip" size="1.15rem" />
          </button>

          <NuxtLink
            :to="{
              path: `/songs/${item.songId}`,
              query: { key: effectiveKey(item), from: `/setlists/${id}` },
            }"
            class="setlist-item__main"
          >
            <span class="setlist-item__pos">{{ index + 1 }}</span>
            <span class="setlist-item__text">
              <span class="setlist-item__title">{{ item.song.title }}</span>
              <AppPill size="sm">{{ songKeyLabel(item) }}</AppPill>
            </span>
          </NuxtLink>

          <button
            v-if="workspace.canEditSetlists"
            type="button"
            class="setlist-item__remove"
            :aria-label="t('setlist.ariaRemove')"
            @click="remove(item)"
          >
            <AppIcon :name="icons.close" size="1.1rem" />
          </button>
        </article>
      </div>

      <div v-if="workspace.canEditSetlists" class="setlist-footer">
        <Button
          :label="t('setlist.addSong')"
          class="w-full"
          :loading="busy"
          @click="openPicker"
        />
        <button type="button" class="setlist-footer__delete app-cta--danger" @click="confirmDelete">
          <AppIcon :name="icons.trash" size="1.05rem" />
          {{ t('setlist.deleteSetlist') }}
        </button>
      </div>
    </template>

    <Dialog
      v-model:visible="pickerVisible"
      modal
      :header="t('songs.library')"
      :style="{ width: 'min(24rem, 100%)' }"
      append-to=".app-shell"
    >
      <AppEmptyState v-if="!availableSongs.length" :title="t('setlist.pickerEmpty')" />
      <AppSurfaceList v-else>
        <button
          v-for="song in availableSongs"
          :key="song.id"
          type="button"
          class="picker-row"
          @click="pickSong(song)"
        >
          <span>{{ song.title }}</span>
          <span class="picker-row__key">{{ song.key }}</span>
        </button>
      </AppSurfaceList>
    </Dialog>
  </div>
</template>

<style scoped>
.setlist-footer {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  margin-top: auto;
  padding-top: var(--app-space-4);
}

.setlist-footer__delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--app-space-2);
  width: 100%;
  min-height: var(--app-touch-min);
  border: 0;
  border-radius: var(--app-radius-lg);
  font: inherit;
  font-weight: 650;
  cursor: pointer;
}

.setlist-items {
  display: flex;
  flex-direction: column;
}

.setlist-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--app-space-1);
  min-height: 3.5rem;
  padding: 0.55rem var(--app-space-2) 0.55rem var(--app-space-1);
  background: transparent;
  touch-action: none;
}

.setlist-item:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 2.75rem;
  right: 0;
  bottom: 0;
  height: var(--app-hairline);
  background: var(--app-border);
}

.setlist-item--ghost {
  opacity: 0.4;
}

.setlist-item--chosen {
  background: var(--app-hover);
  border-radius: var(--app-radius);
  z-index: 1;
}

.setlist-item--chosen::after {
  display: none;
}

.setlist-item--drag {
  opacity: 0.95;
  box-shadow: var(--app-shadow-soft);
  border-radius: var(--app-radius);
  background: var(--app-surface);
}

.setlist-item__handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: transparent;
  color: var(--app-faint);
  cursor: grab;
  touch-action: none;
}

.setlist-item__handle:active {
  cursor: grabbing;
  color: var(--app-muted);
}

.setlist-item__main {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  min-width: 0;
  flex: 1;
  color: inherit;
  text-decoration: none;
  padding-block: 0.2rem;
}

.setlist-item__pos {
  flex-shrink: 0;
  width: 1.15rem;
  color: var(--app-muted);
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  font-size: var(--app-text-sm);
}

.setlist-item__text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
  min-width: 0;
}

.setlist-item__title {
  font-weight: 650;
  letter-spacing: -0.015em;
  color: var(--app-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.setlist-item__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: transparent;
  color: var(--app-destructive);
  opacity: 0.75;
  cursor: pointer;
}

.setlist-item__remove:active {
  background: color-mix(in srgb, var(--app-destructive) 12%, transparent);
  opacity: 1;
}

.picker-row {
  position: relative;
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  min-height: 3.25rem;
  padding: var(--app-space-3) var(--app-space-4);
  border: 0;
  background: transparent;
  color: var(--app-ink);
  font: inherit;
  font-weight: 600;
  letter-spacing: -0.01em;
  text-align: left;
  cursor: pointer;
}

.picker-row:not(:last-child)::after {
  content: '';
  position: absolute;
  left: var(--app-space-4);
  right: 0;
  bottom: 0;
  height: var(--app-hairline);
  background: var(--app-border);
}

.picker-row__key {
  display: inline-flex;
  align-items: center;
  min-height: 1.35rem;
  padding: 0 0.5rem;
  border-radius: var(--app-radius-pill);
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
  font-size: var(--app-text-xs);
  font-weight: 700;
}
</style>
