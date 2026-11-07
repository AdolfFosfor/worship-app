<script setup lang="ts">
import type { SetlistItemWithSong, SetlistWithItems, Song } from '~~/shared/types'
import { icons } from '~/utils/icons'
import { KEY_OPTIONS } from '~/utils/music/keys'

definePageMeta({ hideNav: true })
useTelegramBackButton(true)

const route = useRoute()
const workspace = useWorkspaceStore()
const {
  getSetlist,
  deleteSetlist,
  addSongToSetlist,
  updateItemKey,
  removeItem,
  reorderItems,
} = useSetlists()
const { fetchSongs, songs } = useSongs()
const toast = useToast()
const confirm = useConfirm()

const id = computed(() => String(route.params.id))
const setlist = ref<SetlistWithItems | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const pickerVisible = ref(false)
const busy = ref(false)

async function load() {
  loading.value = true
  error.value = null
  try {
    setlist.value = await getSetlist(id.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не найдено'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function effectiveKey(item: SetlistItemWithSong) {
  return item.key ?? item.song.key
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

async function onKeyChange(item: SetlistItemWithSong, key: string) {
  const next = key === item.song.key ? null : key
  try {
    await updateItemKey(item.id, next)
    if (setlist.value) {
      setlist.value = {
        ...setlist.value,
        items: setlist.value.items.map((i) =>
          i.id === item.id ? { ...i, key: next } : i,
        ),
      }
    }
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: e instanceof Error ? e.message : 'Не удалось сменить тональность',
      life: 4000,
    })
  }
}

async function move(item: SetlistItemWithSong, direction: -1 | 1) {
  if (!setlist.value) return
  const items = [...setlist.value.items]
  const idx = items.findIndex((i) => i.id === item.id)
  const swap = idx + direction
  if (idx < 0 || swap < 0 || swap >= items.length) return
  ;[items[idx], items[swap]] = [items[swap]!, items[idx]!]
  setlist.value = { ...setlist.value, items }
  try {
    await reorderItems(
      id.value,
      items.map((i) => i.id),
    )
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
            class="setlist-delete"
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

      <div v-else class="setlist-items">
        <article v-for="(item, index) in setlist.items" :key="item.id" class="setlist-item">
          <div class="setlist-item__top">
            <NuxtLink
              :to="{ path: `/songs/${item.songId}`, query: { key: effectiveKey(item) } }"
              class="setlist-item__title"
            >
              <span class="setlist-item__pos">{{ index + 1 }}</span>
              {{ item.song.title }}
            </NuxtLink>
            <div v-if="workspace.canEditSetlists" class="setlist-item__ops">
              <button type="button" aria-label="Выше" @click="move(item, -1)">
                <AppIcon :name="icons.up" />
              </button>
              <button type="button" aria-label="Ниже" @click="move(item, 1)">
                <AppIcon :name="icons.down" />
              </button>
              <button type="button" aria-label="Убрать" @click="remove(item)">
                <AppIcon :name="icons.close" />
              </button>
            </div>
          </div>
          <div class="setlist-item__key">
            <span>Тональность</span>
            <Select
              :model-value="effectiveKey(item)"
              :options="KEY_OPTIONS"
              option-label="label"
              option-value="value"
              :disabled="!workspace.canEditSetlists"
              @update:model-value="onKeyChange(item, String($event))"
            />
          </div>
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
  gap: var(--app-space-3);
}

.setlist-item {
  padding: var(--app-space-3) var(--app-space-4);
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.setlist-item__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-2);
}

.setlist-item__title {
  display: flex;
  align-items: baseline;
  gap: var(--app-space-2);
  font-weight: 700;
  color: var(--app-ink);
  text-decoration: none;
}

.setlist-item__pos {
  color: var(--app-muted);
  font-variant-numeric: tabular-nums;
}

.setlist-item__ops {
  display: flex;
  gap: 0.15rem;
}

.setlist-item__ops button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-muted);
  cursor: pointer;
}

.setlist-item__key {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  font-size: var(--app-text-sm);
  color: var(--app-muted);
  font-weight: 600;
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

.setlist-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-destructive);
  cursor: pointer;
}
</style>
