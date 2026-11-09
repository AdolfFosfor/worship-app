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
  addSongToSetlist,
  removeItem,
  reorderItems,
} = useSetlists()
const { syncSetlistsOnActivate } = useSetlistsRevision()
const { fetchSongs, songs } = useSongs()
const toast = useToast()
const { requireDanger } = useAppConfirm()
const haptics = useHaptics()

const id = computed(() => String(route.params.id))
const setlist = ref<SetlistWithItems | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const pickerVisible = ref(false)
const busy = ref(false)
const listEl = ref<HTMLElement | null>(null)
const sorting = ref(false)

/** Long-press → визуальный «набор» + freeze скролла, затем Sortable drag */
const DRAG_DELAY_MS = 400
const SCROLL_FREEZE_MS = 70
const ARM_CANCEL_PX = 10

let sortable: Sortable | null = null
let armEl: HTMLElement | null = null
let armPointerId: number | null = null
let armOriginX = 0
let armOriginY = 0
let freezeTimer: ReturnType<typeof setTimeout> | null = null
let scrollFrozen = false
let suppressClick = false

function onFreezeTouchMove(event: TouchEvent) {
  if (!scrollFrozen && !sorting.value) return
  event.preventDefault()
}

function freezePageScroll() {
  if (scrollFrozen || !import.meta.client) return
  scrollFrozen = true
  document.addEventListener('touchmove', onFreezeTouchMove, { passive: false })
  document.documentElement.classList.add('setlist-drag-freeze')
}

function unfreezePageScroll() {
  if (!import.meta.client) return
  scrollFrozen = false
  document.removeEventListener('touchmove', onFreezeTouchMove)
  document.documentElement.classList.remove('setlist-drag-freeze')
}

function clearFreezeTimer() {
  if (freezeTimer == null) return
  clearTimeout(freezeTimer)
  freezeTimer = null
}

function clearArming(opts?: { keepFreeze?: boolean }) {
  clearFreezeTimer()
  if (armEl) {
    armEl.classList.remove('setlist-item--arming')
    armEl = null
  }
  armPointerId = null
  if (!opts?.keepFreeze && !sorting.value) unfreezePageScroll()
}

function onListPointerDown(event: PointerEvent) {
  if (event.button !== 0 || !workspace.canEditSetlists || sorting.value) return
  const item = (event.target as HTMLElement | null)?.closest?.('.setlist-item')
  if (!(item instanceof HTMLElement) || !listEl.value?.contains(item)) return

  clearArming()
  armEl = item
  armPointerId = event.pointerId
  armOriginX = event.clientX
  armOriginY = event.clientY
  item.classList.add('setlist-item--arming')
  haptics.tap()

  freezeTimer = setTimeout(() => {
    freezeTimer = null
    if (armEl) freezePageScroll()
  }, SCROLL_FREEZE_MS)
}

function onListPointerMove(event: PointerEvent) {
  if (armPointerId == null || event.pointerId !== armPointerId || !armEl) return
  const dx = event.clientX - armOriginX
  const dy = event.clientY - armOriginY
  if (Math.hypot(dx, dy) <= ARM_CANCEL_PX) return
  clearArming()
}

function onListPointerUp(event: PointerEvent) {
  if (armPointerId == null || event.pointerId !== armPointerId) return
  if (!sorting.value) clearArming()
  else {
    armPointerId = null
    clearFreezeTimer()
  }
}

function onListClickCapture(event: MouseEvent) {
  if (!suppressClick) return
  event.preventDefault()
  event.stopPropagation()
  suppressClick = false
}

function bindArmListeners(el: HTMLElement) {
  el.addEventListener('pointerdown', onListPointerDown)
  el.addEventListener('pointermove', onListPointerMove)
  el.addEventListener('pointerup', onListPointerUp)
  el.addEventListener('pointercancel', onListPointerUp)
  el.addEventListener('click', onListClickCapture, true)
}

function unbindArmListeners(el: HTMLElement | null) {
  if (!el) return
  el.removeEventListener('pointerdown', onListPointerDown)
  el.removeEventListener('pointermove', onListPointerMove)
  el.removeEventListener('pointerup', onListPointerUp)
  el.removeEventListener('pointercancel', onListPointerUp)
  el.removeEventListener('click', onListClickCapture, true)
}

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
    }).format(new Date(`${iso}T12:00:00`))
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
  unbindArmListeners(listEl.value)
  clearArming()
  sorting.value = false
  unfreezePageScroll()
  sortable?.destroy()
  sortable = null
}

function setupSortable() {
  destroySortable()
  if (!import.meta.client || !listEl.value || !workspace.canEditSetlists) return
  if (!setlist.value?.items.length) return

  bindArmListeners(listEl.value)

  sortable = Sortable.create(listEl.value, {
    animation: 200,
    direction: 'vertical',
    draggable: '.setlist-item',
    ghostClass: 'setlist-item--ghost',
    chosenClass: 'setlist-item--chosen',
    dragClass: 'setlist-item--drag',
    forceFallback: true,
    fallbackOnBody: true,
    fallbackClass: 'setlist-item--fallback',
    /** Long-press всей карточки (мышь и тач) — иначе мышь крадёт свайп */
    delay: DRAG_DELAY_MS,
    delayOnTouchOnly: false,
    /**
     * После freeze скролла порог можно держать умеренным:
     * горизонтальный свайп всё ещё отменяет delay до freeze.
     */
    touchStartThreshold: 10,
    fallbackTolerance: 12,
    scroll: true,
    bubbleScroll: true,
    scrollSensitivity: 48,
    scrollSpeed: 14,
    forceAutoScrollFallback: true,
    onStart: () => {
      sorting.value = true
      suppressClick = true
      freezePageScroll()
      armEl?.classList.remove('setlist-item--arming')
      armEl = null
      armPointerId = null
      clearFreezeTimer()
      haptics.grab()
    },
    onEnd: (evt) => {
      sorting.value = false
      clearArming()
      unfreezePageScroll()
      suppressClick = true
      window.setTimeout(() => {
        suppressClick = false
      }, 320)
      if (evt.oldIndex == null || evt.newIndex == null || evt.oldIndex === evt.newIndex) return
      if (!setlist.value) return
      haptics.drop()
      const orderedIds = Array.from(
        listEl.value?.querySelectorAll<HTMLElement>('.setlist-item') ?? [],
      )
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

async function doRemove(item: SetlistItemWithSong) {
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

function confirmRemove(item: SetlistItemWithSong) {
  requireDanger({
    title: t('setlist.removeSongConfirmTitle'),
    message: t('setlist.removeSongConfirmMessage', { title: item.song.title }),
    acceptLabel: t('setlist.ariaRemove'),
    accept: () => doRemove(item),
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

      <div
        v-else
        ref="listEl"
        class="setlist-items app-panel"
        :class="{ 'setlist-items--sorting': sorting }"
        :style="{ '--setlist-arm-ms': `${DRAG_DELAY_MS}ms` }"
      >
        <article
          v-for="(item, index) in setlist.items"
          :key="item.id"
          class="setlist-item"
          :data-item-id="item.id"
          data-haptic-drag
        >
          <SwipeDeleteRow
            :disabled="!workspace.canEditSetlists || sorting"
            @commit="confirmRemove(item)"
          >
            <div class="setlist-item__row">
              <NuxtLink
                :to="{
                  path: `/songs/${item.songId}`,
                  query: { key: effectiveKey(item), from: `/setlists/${id}` },
                }"
                class="setlist-item__main"
              >
                <span class="setlist-item__pos">{{ index + 1 }}</span>
                <span class="setlist-item__title">{{ item.song.title }}</span>
              </NuxtLink>
              <span class="setlist-item__key" aria-hidden="true">{{ songKeyLabel(item) }}</span>
            </div>
          </SwipeDeleteRow>
        </article>
      </div>

      <div v-if="workspace.canEditSetlists" class="setlist-footer">
        <button
          type="button"
          class="app-cta setlist-footer__cta"
          :disabled="busy"
          :aria-label="t('setlist.addSong')"
          @click="openPicker"
        >
          <AppIcon :name="icons.add" size="1.1rem" />
          {{ t('setlist.addSong') }}
        </button>
      </div>
    </template>

    <Dialog
      v-model:visible="pickerVisible"
      modal
      dismissable-mask
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

.setlist-footer__cta {
  width: 100%;
}

.setlist-footer__cta:disabled {
  opacity: 0.65;
  cursor: wait;
}

.setlist-items {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  --setlist-arm-ms: 400ms;
}

.setlist-items--sorting {
  cursor: grabbing;
}

.setlist-item {
  position: relative;
  background: var(--app-surface);
  touch-action: manipulation;
}

.setlist-item:not(:last-child)::after {
  content: '';
  position: absolute;
  left: var(--app-space-4);
  right: 0;
  bottom: 0;
  z-index: 2;
  height: var(--app-hairline);
  background: var(--app-border);
  pointer-events: none;
}

.setlist-item--ghost {
  opacity: 0.28;
}

.setlist-item--chosen {
  z-index: 5;
}

.setlist-item--chosen::after,
.setlist-item--arming::after {
  display: none;
}

.setlist-item--arming {
  z-index: 4;
}

.setlist-item--arming .setlist-item__row {
  position: relative;
  z-index: 1;
  border-radius: var(--app-radius);
  background: var(--app-surface);
  transform-origin: center center;
  animation: setlist-item-arm var(--setlist-arm-ms) cubic-bezier(0.22, 1, 0.36, 1) forwards;
  will-change: transform, box-shadow;
}

.setlist-item--drag,
.setlist-item--fallback {
  opacity: 0.98;
  border-radius: var(--app-radius);
  box-shadow:
    0 10px 28px color-mix(in srgb, #000 16%, transparent),
    0 2px 6px color-mix(in srgb, #000 8%, transparent);
  cursor: grabbing;
}

.setlist-item--fallback {
  background: var(--app-surface);
}

.setlist-item--fallback::after {
  display: none;
}

.setlist-item__row {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  min-height: 3.5rem;
  padding: 0.7rem var(--app-space-4);
  transition:
    transform 180ms var(--app-ease),
    box-shadow 180ms var(--app-ease);
}

@keyframes setlist-item-arm {
  from {
    transform: scale(1);
    box-shadow: 0 0 0 transparent;
  }

  to {
    transform: scale(1.045);
    box-shadow:
      0 10px 28px color-mix(in srgb, #000 16%, transparent),
      0 2px 6px color-mix(in srgb, #000 8%, transparent);
  }
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
  width: 1.15rem;
  color: var(--app-muted);
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  font-size: var(--app-text-sm);
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

.setlist-item__key {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.6rem;
  min-height: 2rem;
  padding: 0 0.7rem;
  border-radius: var(--app-radius-pill);
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
  font-size: var(--app-text-md);
  font-weight: 750;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
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

<style>
/* Глобально: во время long-press / drag не даём странице скроллиться пальцем */
html.setlist-drag-freeze,
html.setlist-drag-freeze body {
  overscroll-behavior: none;
  user-select: none;
  -webkit-user-select: none;
}

html.setlist-drag-freeze .app-shell__content {
  overscroll-behavior: none;
}
</style>
