<script setup lang="ts">
import type { AppLocale } from '~~/shared/i18n/locales'
import { authErrorMessage } from '~/utils/authError'
import { resolveAuthDisplayName } from '~/stores/auth'

const auth = useAuthStore()
const workspace = useWorkspaceStore()
const telegram = useTelegramApp()
const toast = useToast()
const { locale, localeOptions, setLocale, t } = useAppLocale()

const displayNameInput = ref('')
const emailInput = ref('')
const busyName = ref(false)
const busyEmail = ref(false)
const busyTelegram = ref(false)
const lastError = ref<string | null>(null)

const needsEmail = computed(() => !auth.user?.hasRealEmail)
const needsTelegram = computed(() => !auth.user?.telegramId)
const canLinkTelegramNow = computed(
  () => Boolean(telegram.getInitDataRaw()) || telegram.isMocked.value,
)

const nameHint = computed(() => {
  if (!auth.user) return ''
  if (auth.user.displayName) return t('settings.displayNameHint')
  const fromTg = [auth.user.firstName, auth.user.lastName].filter(Boolean).join(' ')
  if (fromTg) return t('settings.displayNameHintTelegram', { name: fromTg })
  return t('settings.displayNameHint')
})

const nameDirty = computed(() => {
  const next = displayNameInput.value.trim()
  const current = resolveAuthDisplayName(auth.user)
  return Boolean(next) && next !== current
})

onMounted(async () => {
  await auth.refreshUser()
  displayNameInput.value = resolveAuthDisplayName(auth.user)
})

function onLocaleChange(next: AppLocale) {
  setLocale(next)
}

async function submitDisplayName() {
  if (!nameDirty.value) return
  busyName.value = true
  lastError.value = null
  try {
    const saved = await auth.updateDisplayName(displayNameInput.value)
    displayNameInput.value = saved
    if (workspace.membership && workspace.membership.userId === auth.user?.id) {
      workspace.membership = {
        ...workspace.membership,
        displayName: saved,
      }
    }
    toast.add({
      severity: 'success',
      summary: t('settings.displayNameSaved'),
      life: 2500,
    })
  } catch (e) {
    const detail = authErrorMessage(e, 'settings.errorSaveName')
    lastError.value = detail
    toast.add({
      severity: 'error',
      summary: t('settings.displayName'),
      detail,
      life: 6000,
    })
  } finally {
    busyName.value = false
  }
}

async function submitEmail() {
  if (!emailInput.value.trim()) return
  busyEmail.value = true
  lastError.value = null
  try {
    await auth.linkEmail(emailInput.value.trim())
    emailInput.value = ''
    toast.add({
      severity: 'success',
      summary: t('settings.emailBound'),
      detail: t('settings.emailBoundDetail'),
      life: 5000,
    })
  } catch (e) {
    const detail = authErrorMessage(e, 'settings.errorBindEmail')
    lastError.value = detail
    toast.add({
      severity: 'error',
      summary: t('settings.email'),
      detail,
      life: 8000,
    })
  } finally {
    busyEmail.value = false
  }
}

async function submitTelegram() {
  const raw = telegram.getInitDataRaw()
  if (!raw) {
    toast.add({
      severity: 'warn',
      summary: t('settings.telegram'),
      detail: t('settings.telegramNeedClient'),
      life: 5000,
    })
    return
  }
  busyTelegram.value = true
  lastError.value = null
  try {
    await auth.linkTelegram(raw)
    toast.add({
      severity: 'success',
      summary: t('settings.telegram'),
      detail: t('settings.telegramBoundDetail'),
      life: 5000,
    })
  } catch (e) {
    const detail = authErrorMessage(e, 'settings.errorBindTelegram')
    lastError.value = detail
    toast.add({
      severity: 'error',
      summary: t('settings.telegram'),
      detail,
      life: 8000,
    })
  } finally {
    busyTelegram.value = false
  }
}
</script>

<template>
  <div class="app-page">
    <AppHeader :title="t('settings.title')" />

    <p class="settings-lead">
      {{ t('settings.lead') }}
    </p>

    <section class="settings-block app-panel">
      <h2 class="settings-block__title">{{ t('settings.displayName') }}</h2>
      <form class="settings-form" @submit.prevent="submitDisplayName">
        <label class="settings-field">
          <span>{{ t('settings.displayNameLabel') }}</span>
          <InputText
            v-model="displayNameInput"
            class="w-full"
            :placeholder="t('settings.displayNamePlaceholder')"
            maxlength="80"
            autocomplete="nickname"
          />
        </label>
        <p class="settings-block__hint">{{ nameHint }}</p>
        <Button
          type="submit"
          :label="t('settings.displayNameSave')"
          class="w-full"
          :loading="busyName"
          :disabled="!nameDirty"
        />
      </form>
    </section>

    <section class="settings-block app-panel">
      <h2 class="settings-block__title">{{ t('settings.email') }}</h2>
      <template v-if="auth.user?.pendingEmail">
        <p class="settings-block__status">
          {{ t('settings.emailPending', { email: auth.user.pendingEmail }) }}
        </p>
        <p class="settings-block__hint">{{ t('settings.emailPendingHint') }}</p>
      </template>
      <template v-else-if="auth.user?.hasRealEmail">
        <p class="settings-block__status">
          {{ t('settings.emailLinked', { email: auth.user.email ?? '' }) }}
        </p>
      </template>
      <form v-else class="settings-form" @submit.prevent="submitEmail">
        <label class="settings-field">
          <span>{{ t('settings.emailLabel') }}</span>
          <InputText
            v-model="emailInput"
            type="email"
            class="w-full"
            :placeholder="t('settings.emailPlaceholder')"
            autocomplete="email"
          />
        </label>
        <Button
          type="submit"
          :label="t('settings.emailBind')"
          class="w-full"
          :loading="busyEmail"
          :disabled="!emailInput.trim()"
        />
        <p class="settings-block__hint">
          {{ t('settings.emailHint') }}
        </p>
      </form>
      <p v-if="lastError" class="settings-block__error">{{ lastError }}</p>
    </section>

    <section class="settings-block app-panel">
      <h2 class="settings-block__title">{{ t('settings.telegram') }}</h2>
      <template v-if="auth.user?.telegramId">
        <p class="settings-block__status">
          {{ t('settings.telegramLinked') }}
          <strong>
            <template v-if="auth.user.username">@{{ auth.user.username }}</template>
            <template v-else>ID {{ auth.user.telegramId }}</template>
          </strong>
        </p>
      </template>
      <template v-else>
        <p v-if="!canLinkTelegramNow" class="settings-block__hint">
          {{ t('settings.telegramOpenHint') }}
        </p>
        <Button
          :label="t('settings.telegramBind')"
          class="w-full"
          :loading="busyTelegram"
          :disabled="!canLinkTelegramNow"
          @click="submitTelegram"
        />
        <p v-if="needsEmail && needsTelegram" class="settings-block__hint">
          {{ t('settings.telegramBothHint') }}
        </p>
      </template>
    </section>

    <section class="settings-block app-panel">
      <h2 class="settings-block__title">{{ t('settings.language') }}</h2>
      <Select
        :model-value="locale"
        class="w-full settings-locale"
        :options="localeOptions"
        option-label="label"
        option-value="value"
        @update:model-value="onLocaleChange($event as AppLocale)"
      />
      <p class="settings-block__hint">{{ t('settings.languageHint') }}</p>
    </section>
  </div>
</template>

<style scoped>
.settings-lead {
  margin: 0;
  font-size: var(--app-text-sm);
  color: var(--app-muted);
  line-height: 1.45;
}

.settings-block {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: var(--app-space-4);
}

.settings-block__title {
  margin: 0;
  font-size: var(--app-text-xs);
  font-weight: 650;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--app-section-header);
}

.settings-block__status {
  margin: 0;
  font-size: var(--app-text-md);
  color: var(--app-ink);
  word-break: break-all;
}

.settings-block__hint {
  margin: 0;
  font-size: var(--app-text-sm);
  color: var(--app-muted);
  line-height: 1.4;
}

.settings-block__error {
  margin: 0;
  padding: var(--app-space-3);
  border-radius: var(--app-radius-sm);
  background: color-mix(in srgb, var(--app-danger) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--app-danger) 35%, transparent);
  color: var(--app-ink);
  font-size: var(--app-text-sm);
  line-height: 1.4;
  word-break: break-word;
  user-select: text;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.settings-field {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  font-size: var(--app-text-sm);
  font-weight: 600;
  color: var(--app-section-header);
}

.settings-locale :deep(.p-select-label) {
  display: flex;
  align-items: center;
  font-weight: 400;
  color: var(--app-ink);
  padding-block: 0.75rem;
  line-height: 1.25;
}

.settings-locale :deep(.p-select-dropdown) {
  width: 2.75rem;
}
</style>
