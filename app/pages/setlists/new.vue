<script setup lang="ts">
definePageMeta({ hideNav: true })
useTelegramBackButton(true)

const workspace = useWorkspaceStore()
const { createSetlist } = useSetlists()
const toast = useToast()

const title = ref('Воскресное служение')
const serviceDate = ref<Date>(new Date())
const busy = ref(false)

onMounted(() => {
  if (!workspace.canEditSetlists) void navigateTo('/setlists')
})

function toIsoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function save() {
  if (!title.value.trim() || !serviceDate.value) return
  busy.value = true
  try {
    const setlist = await createSetlist({
      title: title.value.trim(),
      serviceDate: toIsoDate(serviceDate.value),
    })
    toast.add({ severity: 'success', summary: 'Создано', life: 2000 })
    await navigateTo(`/setlists/${setlist.id}`)
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: e instanceof Error ? e.message : 'Не удалось создать',
      life: 4000,
    })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="app-page">
    <AppHeader title="Новый сет-лист" back-to="/setlists" />
    <form class="setlist-form" @submit.prevent="save">
      <label class="setlist-form__field">
        <span>Название</span>
        <InputText v-model="title" class="w-full" />
      </label>
      <label class="setlist-form__field">
        <span>Дата</span>
        <DatePicker v-model="serviceDate" date-format="dd.mm.yy" class="w-full" show-icon />
      </label>
      <Button type="submit" label="Создать" class="w-full" :loading="busy" />
    </form>
  </div>
</template>

<style scoped>
.setlist-form {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.setlist-form__field {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  font-size: var(--app-text-sm);
  font-weight: 600;
  color: var(--app-section-header);
}
</style>
