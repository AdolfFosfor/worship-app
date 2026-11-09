<script setup lang="ts">
import { localDayKey } from '~/utils/dates'

const workspace = useWorkspaceStore()
const { t } = useAppLocale()
const { createSetlist } = useSetlists()
const toast = useToast()

const title = ref(t('setlists.defaultTitle'))
const serviceDate = ref<Date>(new Date())
const busy = ref(false)

onMounted(() => {
  if (!workspace.canEditSetlists) void navigateTo('/setlists')
})

async function save() {
  if (!title.value.trim() || !serviceDate.value) return
  busy.value = true
  try {
    const setlist = await createSetlist({
      title: title.value.trim(),
      serviceDate: localDayKey(serviceDate.value),
    })
    toast.add({ severity: 'success', summary: t('common.created'), life: 2000 })
    await navigateTo(`/setlists/${setlist.id}`)
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: e instanceof Error ? e.message : t('setlists.createFailed'),
      life: 4000,
    })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="app-page">
    <AppHeader :title="t('setlists.newTitle')" />
    <form class="setlist-form" @submit.prevent="save">
      <label class="setlist-form__field">
        <span>{{ t('setlists.fieldTitle') }}</span>
        <InputText v-model="title" class="w-full" />
      </label>
      <label class="setlist-form__field">
        <span>{{ t('setlists.fieldDate') }}</span>
        <DatePicker v-model="serviceDate" date-format="dd.mm.yy" class="w-full" show-icon />
      </label>
      <Button type="submit" :label="t('common.create')" class="w-full" :loading="busy" />
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
