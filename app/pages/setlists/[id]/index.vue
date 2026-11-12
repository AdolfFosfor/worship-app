<script setup lang="ts">
import Sortable from 'sortablejs'
import type { SetlistItemWithSong, SetlistWithItems, Song } from '~~/shared/types'
import { localDayKey } from '~/utils/dates'
import { icons } from '~/utils/icons'
import { soundingKey } from '~/utils/music/capo'

const route = useRoute()
const workspace = useWorkspaceStore()
const { t, sessionTitle, locale } = useAppLocale()
const {
  getSetlist,
  updateSetlist,
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
const { peekSetlist } = useSetlistCache()
const setlist = ref<SetlistWithItems | null>(peekSetlist(id.value))
const loading = ref(!setlist.value)
const error = ref<string | null>(null)
const pickerVisible = ref(false)
const pickerQuery = ref('')
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
  const cached = peekSetlist(id.value)
  if (cached) {
    setlist.value = cached
    loading.value = false
  } else if (!opts?.quiet) {
    loading.value = true
  }
  error.value = null
  try {
    setlist.value = await getSetlist(id.value, {
      force: Boolean(opts?.quiet) || !cached,
    })
    markSetlistsSynced()
  } catch (e) {
    if (!setlist.value) error.value = e instanceof Error ? e.message : t('common.notFound')
  } finally {
    loading.value = false
  }
}

const { markSetlistsSynced } = syncSetlistsOnActivate(() => load({ quiet: true }))
useAppPullRefresh(() => load({ quiet: true }))
onMounted(() => {
  void load()
})

function effectiveKey(item: SetlistItemWithSong) {
  return item.key ?? item.song.key
}

function songMetaLabel(item: SetlistItemWithSong) {
  const key = item.key ?? soundingKey(item.song.key, item.song.capo)
  const parts = [key]
  if (item.song.bpm) parts.push(String(item.song.bpm))
  if (item.song.timeSignature) parts.push(item.song.timeSignature)
  return parts.join(' · ')
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

const canEditMeta = computed(() => workspace.canEditSetlists)
/** Одна строка в шапке — не даём уезжать в простыню. */
const TITLE_MAX_LEN = 48
const titleFocused = ref(false)
const dateOpen = ref(false)
const dateDraft = ref<Date | null>(null)
const titleEl = ref<HTMLElement | null>(null)
const datePicker = ref<{ $el?: HTMLElement } | null>(null)
const metaBusy = ref(false)

async function syncTitleEl(raw?: string | null) {
  await nextTick()
  if (!titleEl.value || titleFocused.value) return
  const value = raw ?? setlist.value?.title
  if (value == null) return
  // Только сырой title — без sessionTitle, иначе focus перезаписывает DOM и каретка в конец
  if (titleEl.value.textContent !== value) {
    titleEl.value.textContent = value
  }
}

watch(
  () => setlist.value?.title,
  (next) => {
    void syncTitleEl(next)
  },
)

watch(titleEl, () => {
  void syncTitleEl()
})

watch(
  () => setlist.value?.serviceDate,
  (next) => {
    if (!next || dateOpen.value) return
    dateDraft.value = new Date(`${next}T12:00:00`)
  },
)

function readTitleText() {
  return (titleEl.value?.innerText ?? '').replace(/\s+/g, ' ').trim()
}

function placeTitleCaretAtEnd() {
  const el = titleEl.value
  if (!el) return
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

function onTitlePointerDown(event: PointerEvent) {
  // preventDefault — браузер не ставит каретку в точку клика (без вспышки)
  event.preventDefault()
  const el = titleEl.value
  if (!el || !setlist.value) return
  if (!titleFocused.value) {
    titleFocused.value = true
    haptics.tap()
  }
  el.focus({ preventScroll: true })
  placeTitleCaretAtEnd()
}

function onTitleFocus() {
  if (!setlist.value) return
  titleFocused.value = true
  placeTitleCaretAtEnd()
}

function onTitleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    titleEl.value?.blur()
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    if (setlist.value && titleEl.value) {
      titleEl.value.textContent = setlist.value.title
    }
    titleEl.value?.blur()
  }
}

function onTitleBeforeInput(event: Event) {
  const e = event as InputEvent
  if (!e.inputType.startsWith('insert')) return
  const el = titleEl.value
  if (!el) return
  const sel = window.getSelection()
  const selected = sel?.toString().length ?? 0
  const len = (el.innerText || '').length - selected
  const incoming = e.data?.length ?? 1
  if (len + incoming > TITLE_MAX_LEN) {
    e.preventDefault()
  }
}

function onTitlePaste(event: ClipboardEvent) {
  event.preventDefault()
  const el = titleEl.value
  if (!el) return
  const paste = event.clipboardData?.getData('text/plain') ?? ''
  const sel = window.getSelection()
  const selected = sel?.toString().length ?? 0
  const current = el.innerText || ''
  const room = TITLE_MAX_LEN - (current.length - selected)
  if (room <= 0) return
  document.execCommand('insertText', false, paste.slice(0, room))
}

async function commitTitle() {
  titleFocused.value = false
  if (!setlist.value || metaBusy.value) return
  const next = readTitleText().slice(0, TITLE_MAX_LEN)
  if (!next) {
    if (titleEl.value) titleEl.value.textContent = setlist.value.title
    return
  }
  if (titleEl.value) titleEl.value.textContent = next
  if (next === setlist.value.title) return

  metaBusy.value = true
  const prev = setlist.value.title
  setlist.value = { ...setlist.value, title: next }
  try {
    await updateSetlist(setlist.value.id, {
      title: next,
      serviceDate: setlist.value.serviceDate,
    })
  } catch (e) {
    setlist.value = { ...setlist.value, title: prev }
    if (titleEl.value) titleEl.value.textContent = prev
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: e instanceof Error ? e.message : t('common.saveFailed'),
      life: 4000,
    })
  } finally {
    metaBusy.value = false
  }
}

function openDatePanel() {
  if (!canEditMeta.value || !setlist.value || metaBusy.value) return
  titleEl.value?.blur()
  dateDraft.value = new Date(`${setlist.value.serviceDate}T12:00:00`)
  haptics.tap()
  void nextTick(() => {
    const root = datePicker.value?.$el as HTMLElement | undefined
    const trigger =
      root?.querySelector?.('button.p-datepicker-dropdown') ??
      root?.querySelector?.('input')
    if (trigger instanceof HTMLElement) trigger.click()
  })
}

function onDateShow() {
  dateOpen.value = true
}

function onDateHide() {
  dateOpen.value = false
  if (setlist.value) {
    dateDraft.value = new Date(`${setlist.value.serviceDate}T12:00:00`)
  }
}

async function commitDate(value?: Date | Date[] | null) {
  if (!setlist.value || metaBusy.value) return
  const picked = Array.isArray(value) ? value[0] : (value ?? dateDraft.value)
  if (!(picked instanceof Date) || Number.isNaN(picked.getTime())) return

  const next = localDayKey(picked)
  if (next === setlist.value.serviceDate) return

  metaBusy.value = true
  const prev = setlist.value.serviceDate
  setlist.value = { ...setlist.value, serviceDate: next }
  try {
    await updateSetlist(setlist.value.id, {
      title: setlist.value.title,
      serviceDate: next,
    })
  } catch (e) {
    setlist.value = { ...setlist.value, serviceDate: prev }
    dateDraft.value = new Date(`${prev}T12:00:00`)
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: e instanceof Error ? e.message : t('common.saveFailed'),
      life: 4000,
    })
  } finally {
    metaBusy.value = false
  }
}

async function openPicker() {
  pickerQuery.value = ''
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

const filteredPickerSongs = computed(() => {
  const q = pickerQuery.value.trim().toLocaleLowerCase()
  if (!q) return availableSongs.value
  return availableSongs.value.filter(
    (s) =>
      s.title.toLocaleLowerCase().includes(q) ||
      s.key.toLocaleLowerCase().includes(q),
  )
})
const { revealEditable } = useHeaderEditableTitle({
  title: () => (setlist.value ? sessionTitle(setlist.value.title) : ''),
  canEdit: canEditMeta,
  entityKey: () => setlist.value?.id,
  extra: () => ({
    customSubtitle: Boolean(setlist.value),
  }),
})
</script>

<template>
  <div class="app-page">
    <AppLoading v-if="loading" />
    <AppError v-else-if="error" :message="error" @retry="load" />
    <template v-else-if="setlist">
      <AppHeaderPortal
        v-if="revealEditable"
        to="[data-app-header-title]"
      >
        <h1
          ref="titleEl"
          class="app-header-editable-title app-header-editable-title--editable"
          :class="{ 'is-editing': titleFocused }"
          contenteditable="true"
          spellcheck="false"
          :aria-label="t('setlist.editTitleAria')"
          @pointerdown="onTitlePointerDown"
          @focus="onTitleFocus"
          @blur="commitTitle"
          @keydown="onTitleKeydown"
          @beforeinput="onTitleBeforeInput"
          @paste="onTitlePaste"
        />
      </AppHeaderPortal>
      <AppHeaderPortal to="[data-app-header-subtitle]">
        <div
          class="setlist-header__date-wrap"
          :class="{
            'is-editable': canEditMeta,
            'is-open': dateOpen,
          }"
        >
          <button
            v-if="canEditMeta"
            type="button"
            class="setlist-header__subtitle"
            :aria-label="t('setlist.editDateAria')"
            :aria-expanded="dateOpen"
            @click="openDatePanel"
          >
            {{ formatDate(setlist.serviceDate) }}
          </button>
          <p v-else class="setlist-header__subtitle">{{ formatDate(setlist.serviceDate) }}</p>
          <DatePicker
            v-if="canEditMeta"
            ref="datePicker"
            v-model="dateDraft"
            date-format="dd.mm.yy"
            class="setlist-header__date-ghost"
            :manual-input="false"
            append-to=".app-shell"
            panel-class="setlist-header-datepicker"
            tabindex="-1"
            aria-hidden="true"
            @show="onDateShow"
            @hide="onDateHide"
            @date-select="commitDate"
          />
        </div>
      </AppHeaderPortal>

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
              <span class="setlist-item__meta" aria-hidden="true">{{ songMetaLabel(item) }}</span>
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
      class="setlist-song-picker"
      :pt="{
        root: { class: 'setlist-song-picker' },
        content: { class: 'setlist-song-picker__content' },
      }"
      append-to=".app-shell"
      @hide="pickerQuery = ''"
    >
      <div class="setlist-picker">
        <div class="setlist-picker__search">
          <AppIcon :name="icons.search" class="setlist-picker__search-icon" />
          <InputText
            v-model="pickerQuery"
            class="w-full setlist-picker__search-input"
            :placeholder="t('songs.searchPlaceholder')"
          />
        </div>

        <AppEmptyState
          v-if="!availableSongs.length"
          compact
          :title="t('setlist.pickerEmpty')"
        />
        <AppEmptyState
          v-else-if="!filteredPickerSongs.length"
          compact
          :title="t('setlist.pickerNoResults')"
        />
        <div v-else class="setlist-picker__list">
          <AppSurfaceList>
            <button
              v-for="song in filteredPickerSongs"
              :key="song.id"
              type="button"
              class="picker-row"
              @click="pickSong(song)"
            >
              <span>{{ song.title }}</span>
              <span class="picker-row__key">{{ song.key }}</span>
            </button>
          </AppSurfaceList>
        </div>
      </div>
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
  left: var(--app-page-inline);
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
  padding: 0.7rem var(--app-page-inline);
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

.setlist-item__meta {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.5rem;
  padding: 0 0.55rem;
  border-radius: var(--app-radius-pill);
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
  font-size: var(--app-text-xs);
  font-weight: 700;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.setlist-picker {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  min-height: 0;
  height: 100%;
}

.setlist-picker__search {
  position: relative;
  flex-shrink: 0;
  width: 100%;
}

.setlist-picker__search-icon {
  position: absolute;
  left: 0.9rem;
  top: 50%;
  z-index: 1;
  width: 1.1rem;
  height: 1.1rem;
  transform: translateY(-50%);
  color: var(--app-muted);
  pointer-events: none;
}

.setlist-picker__search :deep(.setlist-picker__search-input),
.setlist-picker__search :deep(input) {
  min-height: 2.75rem;
  padding-left: 2.5rem;
  padding-block: 0.7rem;
  border-radius: var(--app-radius-pill) !important;
  border: 1px solid var(--app-border) !important;
  background: var(--app-bg) !important;
}

.setlist-picker__list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.picker-row {
  position: relative;
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  min-height: 3.25rem;
  padding: var(--app-space-3) var(--app-page-inline);
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
  left: var(--app-page-inline);
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

.setlist-header__date-wrap {
  position: relative;
  margin-top: 0.15rem;
  width: fit-content;
  max-width: 100%;
}

.setlist-header__subtitle {
  display: block;
  width: fit-content;
  max-width: 100%;
  margin: 0;
  padding: 0.1rem 0;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: var(--app-text-sm);
  font-weight: 500;
  line-height: 1.3;
  text-align: left;
  color: var(--app-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-radius: 0.25rem;
  box-shadow: inset 0 -1.5px 0 transparent;
  transition:
    color 160ms var(--app-ease),
    box-shadow 160ms var(--app-ease),
    opacity 120ms var(--app-ease);
}

.setlist-header__date-wrap.is-editable .setlist-header__subtitle {
  cursor: pointer;
}

.setlist-header__date-wrap.is-editable .setlist-header__subtitle:active {
  opacity: 0.7;
}

.setlist-header__date-wrap.is-open .setlist-header__subtitle {
  color: var(--app-accent-text);
  box-shadow: inset 0 -1.5px 0 var(--app-accent);
}

/* Скрытый DatePicker — только для панели, текст даты не прыгает */
.setlist-header__date-ghost {
  position: absolute;
  left: 0;
  top: 100%;
  width: 1px;
  height: 1px;
  margin: 0;
  padding: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
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

.app-shell > .p-datepicker-panel.setlist-header-datepicker,
.app-shell .p-datepicker-panel.setlist-header-datepicker {
  position: fixed !important;
  z-index: 1300 !important;
  translate: 0 calc(-1 * var(--app-safe-bottom));
  padding-bottom: var(--app-space-1) !important;
}
</style>
