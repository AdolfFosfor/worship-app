<script setup lang="ts">
definePageMeta({
  hideNav: true,
  public: true,
})

const auth = useAuthStore()
const workspace = useWorkspaceStore()

onMounted(async () => {
  await auth.init()
  if (auth.isAuthenticated) {
    await workspace.loadCurrent()
    await navigateTo(workspace.hasWorkspace ? '/' : '/onboarding')
    return
  }
  await navigateTo('/login')
})
</script>

<template>
  <div class="app-page">
    <AppLoading label="Входим…" />
  </div>
</template>
