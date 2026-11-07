<script setup lang="ts">
import type { SongInput } from '~~/shared/types'

definePageMeta({ hideNav: true })
useTelegramBackButton(true)

const workspace = useWorkspaceStore()
const { createSong } = useSongs()
const toast = useToast()

const form = ref<SongInput>({
  title: '',
  key: 'G',
  chords: '',
  lyrics: '',
  youtubeUrl: '',
})
const busy = ref(false)

onMounted(() => {
  if (!workspace.canEditSongs) {
    void navigateTo('/songs')
  }
})

async function save() {
  busy.value = true
  try {
    const song = await createSong(form.value)
    toast.add({ severity: 'success', summary: 'Сохранено', life: 2000 })
    await navigateTo(`/songs/${song.id}`)
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
    <AppHeader title="Новая песня" back-to="/songs" />
    <SongForm v-model="form" submit-label="Добавить" :busy="busy" @submit="save" />
  </div>
</template>
