<script setup lang="ts">
definePageMeta({
  hideNav: true,
  public: true,
})

const route = useRoute()
const auth = useAuthStore()
const workspace = useWorkspaceStore()
const toast = useToast()
const code = computed(() => String(route.params.code ?? ''))

const busy = ref(false)

async function accept() {
  if (!auth.isAuthenticated) {
    await navigateTo({ path: '/login', query: { redirect: `/invite/${code.value}` } })
    return
  }
  busy.value = true
  try {
    await workspace.joinByInviteCode(code.value)
    toast.add({ severity: 'success', summary: 'Готово', detail: 'Вы в команде', life: 2500 })
    await navigateTo('/')
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Приглашение',
      detail: e instanceof Error ? e.message : 'Ошибка',
      life: 4000,
    })
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  if (auth.isAuthenticated) void accept()
})
</script>

<template>
  <div class="app-page">
    <AppHeader title="Приглашение" :back-to="'/'" />
    <p class="invite__code">Код: {{ code }}</p>
    <Button label="Присоединиться" class="w-full" :loading="busy" @click="accept" />
  </div>
</template>

<style scoped>
.invite__code {
  margin: 0;
  font-size: var(--app-text-lg);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-align: center;
}
</style>
