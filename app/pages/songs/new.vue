<script setup lang="ts">
import type { SongInput } from '~~/shared/types'
import type { SongExtraKind } from '~/components/SongForm.vue'
import { icons } from '~/utils/icons'

const workspace = useWorkspaceStore()
const { t } = useAppLocale()
const { createSong } = useSongs()
const toast = useToast()

const form = ref<SongInput>({
  title: '',
  artist: null,
  key: 'G',
  capo: 0,
  bpm: null,
  types: [],
  themes: [],
  timeSignature: null,
  chords: null,
  chordChart: null,
  lyrics: '',
  youtubeUrl: '',
})
const busy = ref(false)
const songForm = ref<{ openExtra: (kind: SongExtraKind) => void } | null>(null)
const extrasMenuOpen = ref(false)
const extrasMenu = ref<{ toggle: (event: Event) => void; close: () => void } | null>(null)

onMounted(() => {
  if (!workspace.canEditSongs) {
    void navigateTo('/songs')
  }
})

function toggleExtras(event: Event) {
  extrasMenu.value?.toggle(event)
}

function pickExtra(kind: SongExtraKind) {
  // openExtra сначала: proxy-focus в том же жесте, потом закрываем меню
  songForm.value?.openExtra(kind)
  extrasMenu.value?.close()
}

async function save() {
  busy.value = true
  try {
    const song = await createSong(form.value)
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2000 })
    await navigateTo(`/songs/${song.id}`, { replace: true })
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
        <button
          type="button"
          class="app-header-action"
          :aria-label="t('songs.ariaExtras')"
          aria-haspopup="menu"
          @click="toggleExtras"
        >
          <AppIcon :name="icons.extras" />
        </button>
      </template>
    </AppHeader>

    <AppAnchoredMenu
      ref="extrasMenu"
      v-model:open="extrasMenuOpen"
      :label="t('songs.extrasMenuAria')"
    >
      <div class="app-create-menu">
        <button
          type="button"
          class="app-create-menu__item app-create-menu__item--lyrics"
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
          class="app-create-menu__item app-create-menu__item--bpm"
          role="menuitem"
          @click="pickExtra('bpm')"
        >
          <span class="app-create-menu__icon">
            <AppIcon :name="icons.music" :size="18" />
          </span>
          <span class="app-create-menu__label">{{ t('song.fieldBpm') }}</span>
        </button>
        <button
          type="button"
          class="app-create-menu__item app-create-menu__item--meter"
          role="menuitem"
          @click="pickExtra('meter')"
        >
          <span class="app-create-menu__icon">
            <AppIcon :name="icons.notes" :size="18" />
          </span>
          <span class="app-create-menu__label">{{ t('song.fieldMeter') }}</span>
        </button>
        <button
          type="button"
          class="app-create-menu__item app-create-menu__item--types"
          role="menuitem"
          @click="pickExtra('types')"
        >
          <span class="app-create-menu__icon">
            <AppIcon :name="icons.tag" :size="18" />
          </span>
          <span class="app-create-menu__label">{{ t('song.fieldTypes') }}</span>
        </button>
        <button
          type="button"
          class="app-create-menu__item app-create-menu__item--themes"
          role="menuitem"
          @click="pickExtra('themes')"
        >
          <span class="app-create-menu__icon">
            <AppIcon :name="icons.tagHorizontal" :size="18" />
          </span>
          <span class="app-create-menu__label">{{ t('song.fieldThemes') }}</span>
        </button>
        <button
          type="button"
          class="app-create-menu__item app-create-menu__item--youtube"
          role="menuitem"
          @click="pickExtra('youtube')"
        >
          <span class="app-create-menu__icon">
            <AppIcon :name="icons.youtube" :size="18" />
          </span>
          <span class="app-create-menu__label">{{ t('song.extraYoutube') }}</span>
        </button>
      </div>
    </AppAnchoredMenu>

    <SongForm
      ref="songForm"
      v-model="form"
      :submit-label="t('common.add')"
      :busy="busy"
      @submit="save"
    />
  </div>
</template>
