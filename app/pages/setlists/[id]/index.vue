<script setup lang="ts">
import Sortable from 'sortablejs'
import type { SetlistItemWithSong, SetlistWithItems, Song } from '~~/shared/types'
import { icons } from '~/utils/icons'
import { soundingKey } from '~/utils/music/capo'

useTelegramBackButton(true)

const route = useRoute()
const workspace = useWorkspaceStore()
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
const confirm = useConfirm()

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
    error.value = e instanceof Error ? e.message : 'Не найдено'
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

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
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
      summary: 'Ошибка',
      detail: e instanceof Error ? e.message : 'Не удалось добавить',
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
      summary: 'Ошибка',
      detail: e instanceof Error ? e.message : 'Не удалось изменить порядок',
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
      summary: 'Ошибка',
      detail: e instanceof Error ? e.message : 'Не удалось удалить',
      life: 4000,
    })
  }
}

function confirmDelete() {
  confirm.require({
    message: 'Удалить сет-лист?',
    header: 'Удаление',
    rejectLabel: 'Отмена',
    acceptLabel: 'Удалить',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await deleteSetlist(id.value)
        await navigateTo('/setlists')
      } catch (e) {
        toast.add({
          severity: 'error',
          summary: 'Ошибка',
          detail: e instanceof Error ? e.message : 'Не удалось удалить',
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
        :title="setlist.title"
        :subtitle="formatDate(setlist.serviceDate)"
        back-to="/setlists"
      >
        <template v-if="workspace.canEditSetlists" #trailing>
          <button
            type="button"
            class="app-header-action app-header-action--danger"
            aria-label="Удалить"
            @click="confirmDelete"
          >
            <AppIcon :name="icons.trash" />
          </button>
        </template>
      </AppHeader>

      <AppEmptyState
        v-if="!setlist.items.length"
        title="Песен пока нет"
        description="Добавьте песни из библиотеки"
      />

      <div v-else ref="listEl" class="setlist-items">
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
            aria-label="Перетащить"
          >
            <AppIcon :name="icons.grip" size="1.25rem" />
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
              <span class="setlist-item__key">{{ songKeyLabel(item) }}</span>
            </span>
          </NuxtLink>

          <button
            v-if="workspace.canEditSetlists"
            type="button"
            class="setlist-item__remove"
            aria-label="Убрать"
            @click="remove(item)"
          >
            <AppIcon :name="icons.close" size="1.25rem" />
          </button>
        </article>
      </div>

      <Button
        v-if="workspace.canEditSetlists"
        label="Добавить песню"
        class="w-full"
        :loading="busy"
        @click="openPicker"
      />
    </template>

    <Dialog
      v-model:visible="pickerVisible"
      modal
      header="Библиотека"
      :style="{ width: 'min(24rem, 100%)' }"
      append-to=".app-shell"
    >
      <AppEmptyState v-if="!availableSongs.length" title="Нечего добавлять" />
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
.setlist-items {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.setlist-item {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  min-height: 3.25rem;
  padding: var(--app-space-2) var(--app-space-3);
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  touch-action: none;
}

.setlist-item--ghost {
  opacity: 0.45;
}

.setlist-item--chosen {
  border-color: color-mix(in srgb, var(--app-accent) 45%, var(--app-border));
  box-shadow: 0 8px 20px color-mix(in srgb, #000 18%, transparent);
}

.setlist-item--drag {
  opacity: 0.95;
}

.setlist-item__handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-muted);
  cursor: grab;
  touch-action: none;
}

.setlist-item__handle:active {
  cursor: grabbing;
}

.setlist-item__main {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  min-width: 0;
  flex: 1;
  color: inherit;
  text-decoration: none;
}

.setlist-item__pos {
  flex-shrink: 0;
  width: 1.25rem;
  color: var(--app-muted);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: var(--app-text-sm);
}

.setlist-item__text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.setlist-item__title {
  font-weight: 700;
  color: var(--app-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.setlist-item__key {
  font-size: var(--app-text-sm);
  font-weight: 600;
  color: var(--app-accent-text);
}

.setlist-item__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-destructive);
  cursor: pointer;
}

.picker-row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  min-height: var(--app-touch-min);
  padding: var(--app-space-3) var(--app-space-4);
  border: 0;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface);
  color: var(--app-ink);
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.picker-row__key {
  color: var(--app-accent-text);
}
</style>
