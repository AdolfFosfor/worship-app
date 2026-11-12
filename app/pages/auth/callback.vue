<script setup lang="ts">
definePageMeta({
  hideNav: true,
  public: true,
})

useAppHeader({ visible: false })

const auth = useAuthStore()
const workspace = useWorkspaceStore()
const { t } = useAppLocale()

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
    <AppLoading :label="t('auth.signingIn')" />
  </div>
</template>
