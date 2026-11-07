<script setup lang="ts">
definePageMeta({
  hideNav: true,
})

const workspace = useWorkspaceStore()
const toast = useToast()

const mode = ref<'create' | 'join'>('create')
const name = ref('')
const inviteCode = ref('')
const busy = ref(false)

async function create() {
  if (!name.value.trim()) return
  busy.value = true
  try {
    await workspace.createWorkspace(name.value.trim())
    await navigateTo('/')
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Команда',
      detail: e instanceof Error ? e.message : 'Ошибка',
      life: 4000,
    })
  } finally {
    busy.value = false
  }
}

async function join() {
  if (!inviteCode.value.trim()) return
  busy.value = true
  try {
    await workspace.joinByInviteCode(inviteCode.value.trim())
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
</script>

<template>
  <div class="app-page">
    <AppHeader title="Ваша команда" />

    <div class="onboarding__tabs">
      <button
        type="button"
        class="onboarding__tab"
        :class="{ 'onboarding__tab--active': mode === 'create' }"
        @click="mode = 'create'"
      >
        Создать
      </button>
      <button
        type="button"
        class="onboarding__tab"
        :class="{ 'onboarding__tab--active': mode === 'join' }"
        @click="mode = 'join'"
      >
        Присоединиться
      </button>
    </div>

    <form v-if="mode === 'create'" class="onboarding__form" @submit.prevent="create">
      <label class="onboarding__field">
        <span>Название команды</span>
        <InputText v-model="name" class="w-full" placeholder="Worship Team" autofocus />
      </label>
      <Button type="submit" label="Создать" class="w-full" :loading="busy" :disabled="!name.trim()" />
    </form>

    <form v-else class="onboarding__form" @submit.prevent="join">
      <label class="onboarding__field">
        <span>Код приглашения</span>
        <InputText v-model="inviteCode" class="w-full" placeholder="ABCD1234" autofocus />
      </label>
      <Button
        type="submit"
        label="Войти в команду"
        class="w-full"
        :loading="busy"
        :disabled="!inviteCode.trim()"
      />
    </form>
  </div>
</template>

<style scoped>
.onboarding__tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--app-space-2);
  padding: var(--app-space-1);
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
}

.onboarding__tab {
  min-height: 2.5rem;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-muted);
  font-weight: 600;
  cursor: pointer;
}

.onboarding__tab--active {
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
}

.onboarding__form {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.onboarding__field {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  font-size: var(--app-text-sm);
  font-weight: 600;
  color: var(--app-section-header);
}
</style>
