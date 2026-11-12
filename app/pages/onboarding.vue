<script setup lang="ts">
definePageMeta({
  hideNav: true,
})

const workspace = useWorkspaceStore()
const toast = useToast()
const { t } = useAppLocale()

const mode = ref<'create' | 'join'>('create')
const name = ref('')
const inviteCode = ref('')
const busy = ref(false)

const nameInput = ref<{ $el?: HTMLElement } | null>(null)
const inviteInput = ref<{ $el?: HTMLElement } | null>(null)
/** Keeps the soft keyboard alive while the real field mounts / switches. */
const focusProxy = ref<HTMLInputElement | null>(null)

function resolveInputEl(comp: { $el?: HTMLElement } | null): HTMLInputElement | null {
  const root = comp?.$el
  if (!root) return null
  if (root instanceof HTMLInputElement) return root
  return root.querySelector?.('input') ?? null
}

function focusModeField(next: 'create' | 'join') {
  const el = resolveInputEl(next === 'create' ? nameInput.value : inviteInput.value)
  el?.focus({ preventScroll: true })
}

function setMode(next: 'create' | 'join') {
  // Proxy focus in the same user gesture, then hand off to the visible field.
  focusProxy.value?.focus({ preventScroll: true })
  mode.value = next
  nextTick(() => {
    focusModeField(next)
  })
}

async function create() {
  if (!name.value.trim()) return
  busy.value = true
  try {
    await workspace.createWorkspace(name.value.trim())
    await navigateTo('/')
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: t('onboarding.teamToast'),
      detail: e instanceof Error ? e.message : t('common.error'),
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
      summary: t('onboarding.inviteToast'),
      detail: e instanceof Error ? e.message : t('common.error'),
      life: 4000,
    })
  } finally {
    busy.value = false
  }
}
useAppHeader(() => ({
  title: t('onboarding.title'),
}))
</script>

<template>
  <div class="app-page">
    <input
      ref="focusProxy"
      class="onboarding__focus-proxy"
      type="text"
      tabindex="-1"
      aria-hidden="true"
      inputmode="text"
      autocomplete="off"
    >

    <div class="onboarding__tabs">
      <button
        type="button"
        class="onboarding__tab"
        :class="{ 'onboarding__tab--active': mode === 'create' }"
        @click="setMode('create')"
      >
        {{ t('onboarding.tabCreate') }}
      </button>
      <button
        type="button"
        class="onboarding__tab"
        :class="{ 'onboarding__tab--active': mode === 'join' }"
        @click="setMode('join')"
      >
        {{ t('onboarding.tabJoin') }}
      </button>
    </div>

    <!-- v-show: keep both inputs mounted so focus handoff stays in the gesture chain -->
    <form v-show="mode === 'create'" class="onboarding__form" @submit.prevent="create">
      <label class="onboarding__field">
        <span>{{ t('onboarding.teamNameLabel') }}</span>
        <InputText
          ref="nameInput"
          v-model="name"
          class="w-full"
          :placeholder="t('onboarding.teamNamePlaceholder')"
        />
      </label>
      <Button
        type="submit"
        :label="t('common.create')"
        class="w-full"
        :loading="busy"
        :disabled="!name.trim()"
      />
    </form>

    <form v-show="mode === 'join'" class="onboarding__form" @submit.prevent="join">
      <label class="onboarding__field">
        <span>{{ t('onboarding.inviteCodeLabel') }}</span>
        <InputText
          ref="inviteInput"
          v-model="inviteCode"
          class="w-full"
          :placeholder="t('onboarding.inviteCodePlaceholder')"
        />
      </label>
      <Button
        type="submit"
        :label="t('onboarding.joinSubmit')"
        class="w-full"
        :loading="busy"
        :disabled="!inviteCode.trim()"
      />
    </form>
  </div>
</template>

<style scoped>
.onboarding__focus-proxy {
  position: fixed;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  opacity: 0;
  border: 0;
  padding: 0;
  margin: 0;
  pointer-events: none;
}

.onboarding__tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--app-space-1);
  padding: var(--app-space-1);
  border-radius: var(--app-radius-pill);
  background: var(--app-surface);
}

.onboarding__tab {
  min-height: 2.5rem;
  border: 0;
  border-radius: var(--app-radius-pill);
  background: transparent;
  color: var(--app-muted);
  font: inherit;
  font-weight: 650;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition:
    background-color var(--app-duration) var(--app-ease),
    color var(--app-duration) var(--app-ease);
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
