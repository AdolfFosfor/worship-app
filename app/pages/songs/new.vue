<script setup lang="ts">
import type Popover from 'primevue/popover'
import type { SongInput } from '~~/shared/types'
import type { SongExtraKind } from '~/components/SongForm.vue'
import { icons } from '~/utils/icons'
import {
  clampOverlayToFrameAfterShow,
  resolvePopoverEl,
} from '~/utils/dom/clampOverlayToFrame'

const workspace = useWorkspaceStore()
const { t } = useAppLocale()
const { createSong } = useSongs()
const toast = useToast()

const form = ref<SongInput>({
  title: '',
  key: 'G',
  capo: 0,
  bpm: null,
  chords: null,
  chordChart: null,
  lyrics: '',
  youtubeUrl: '',
})
const busy = ref(false)
const songForm = ref<{ openExtra: (kind: SongExtraKind) => void } | null>(null)
const extrasPopover = useTemplateRef<InstanceType<typeof Popover>>('extrasPopover')

onMounted(() => {
  if (!workspace.canEditSongs) {
    void navigateTo('/songs')
  }
})

function toggleExtras(event: Event) {
  extrasPopover.value?.toggle(event)
}

function onExtrasShow() {
  clampOverlayToFrameAfterShow(resolvePopoverEl(extrasPopover.value))
}

function pickExtra(kind: SongExtraKind) {
  // openExtra сначала: proxy-focus в том же жесте, потом закрываем меню
  songForm.value?.openExtra(kind)
  extrasPopover.value?.hide()
}

const hasLyrics = computed(() => Boolean(form.value.lyrics?.trim()))
const hasYoutube = computed(() => Boolean(form.value.youtubeUrl?.trim()))
const hasExtras = computed(() => hasLyrics.value || hasYoutube.value)

async function save() {
  busy.value = true
  try {
    const song = await createSong(form.value)
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2000 })
    await navigateTo(`/songs/${song.id}`)
  } catch (e) {
    const detail =
      e instanceof Error && e.message
        ? e.message
        : e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
          ? (e as { message: string }).message
          : t('common.saveFailed')
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail,
      life: 5000,
    })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="app-page">
    <AppHeader :title="t('songs.newTitle')">
      <template #trailing>
        <div class="app-header-extras">
          <span
            v-if="hasExtras"
            class="app-header-extras__marks"
            aria-hidden="true"
          >
            <span v-if="hasLyrics" class="app-header-extras__mark app-header-extras__mark--lyrics">
              <AppIcon :name="icons.documentText" :size="16" />
            </span>
            <span v-if="hasYoutube" class="app-header-extras__mark app-header-extras__mark--youtube">
              <AppIcon :name="icons.youtube" :size="16" />
            </span>
          </span>
          <button
            type="button"
            class="app-header-action"
            :aria-label="t('songs.ariaExtras')"
            aria-haspopup="menu"
            @click="toggleExtras"
          >
            <AppIcon :name="icons.extras" />
          </button>
        </div>
      </template>
    </AppHeader>

    <Popover
      ref="extrasPopover"
      class="app-create-popover"
      append-to=".app-shell"
      @show="onExtrasShow"
    >
      <div class="app-create-menu" role="menu" :aria-label="t('songs.extrasMenuAria')">
        <button
          type="button"
          class="app-create-menu__item app-create-menu__item--song"
          role="menuitem"
          @click="pickExtra('lyrics')"
        >
          <span class="app-create-menu__icon">
            <AppIcon :name="icons.documentText" :size="18" />
          </span>
          <span class="app-create-menu__label">{{ t('song.extraLyrics') }}</span>
        </button>
        <button
          type="button"
          class="app-create-menu__item app-create-menu__item--setlist"
          role="menuitem"
          @click="pickExtra('youtube')"
        >
          <span class="app-create-menu__icon">
            <AppIcon :name="icons.youtube" :size="18" />
          </span>
          <span class="app-create-menu__label">{{ t('song.extraYoutube') }}</span>
        </button>
        <button
          type="button"
          class="app-create-menu__item app-create-menu__item--song"
          role="menuitem"
          @click="pickExtra('bpm')"
        >
          <span class="app-create-menu__icon">
            <AppIcon :name="icons.music" :size="18" />
          </span>
          <span class="app-create-menu__label">{{ t('song.fieldBpm') }}</span>
        </button>
      </div>
    </Popover>

    <SongForm
      ref="songForm"
      v-model="form"
      :submit-label="t('common.add')"
      :busy="busy"
      @submit="save"
    />
  </div>
</template>
