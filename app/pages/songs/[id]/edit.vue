<script setup lang="ts">
import type { SongInput } from '~~/shared/types'

useTelegramBackButton(true)

const route = useRoute()
const workspace = useWorkspaceStore()
const { getSong, updateSong } = useSongs()
const toast = useToast()

const id = computed(() => String(route.params.id))
const form = ref<SongInput>({
  title: '',
  key: 'G',
  capo: 0,
  chords: '',
  lyrics: '',
  youtubeUrl: '',
})
const loading = ref(true)
const busy = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  if (!workspace.canEditSongs) {
    await navigateTo(`/songs/${id.value}`)
    return
  }
  try {
    const song = await getSong(id.value)
    form.value = {
      title: song.title,
      key: song.key,
      capo: song.capo,
      chords: song.chords,
      lyrics: song.lyrics,
      youtubeUrl: song.youtubeUrl,
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не найдено'
  } finally {
    loading.value = false
  }
})

async function save() {
  busy.value = true
  try {
    await updateSong(id.value, form.value)
    toast.add({ severity: 'success', summary: 'Сохранено', life: 2000 })
    await navigateTo(`/songs/${id.value}`)
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: e instanceof Error ? e.message : 'Не удалось сохранить',
      life: 4000,
    })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="app-page">
    <AppHeader title="Редактирование" :back-to="`/songs/${id}`" />
    <AppLoading v-if="loading" />
    <AppError v-else-if="error" :message="error" @retry="$router.go(0)" />
    <SongForm v-else v-model="form" :busy="busy" @submit="save" />
  </div>
</template>
