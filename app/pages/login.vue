<script setup lang="ts">
import { authErrorMessage } from '~/utils/authError'

definePageMeta({
  hideNav: true,
  public: true,
})

const auth = useAuthStore()
const telegram = useTelegramApp()
const toast = useToast()
const config = useRuntimeConfig()
const { t } = useAppLocale()

const DEV_EMAIL_KEY = 'worship-dev-email'

const email = ref('')
const sent = ref(false)
const busy = ref(false)
const telegramFailed = ref(false)

/** Real Mini App only — browser mock uses Magic Link / dev session. */
const showTelegram = computed(() => telegram.isTelegramEnvironment.value)
/** Dev-вход только вне Telegram и только при явном флаге. */
const allowDevSession = computed(
  () => Boolean(config.public.allowTelegramDevMock) && !showTelegram.value,
)
/** В настоящем TMA — только Telegram, без email/dev. */
const showEmailForm = computed(() => !showTelegram.value)

async function loginTelegram() {
  busy.value = true
  telegramFailed.value = false
  try {
    const raw = telegram.getInitDataRaw()
    if (!raw) {
      throw new Error(t('auth.noTelegramData'))
    }
    await auth.signInWithTelegram(raw)
    await navigateTo('/')
  } catch (e) {
    telegramFailed.value = true
    toast.add({
      severity: 'error',
      summary: t('auth.toastTitle'),
      detail: authErrorMessage(e, 'auth.telegramRetryHint'),
      life: 6000,
    })
  } finally {
    busy.value = false
  }
}

async function loginEmail() {
  if (!email.value.trim()) return
  busy.value = true
  try {
    await auth.signInWithEmail(email.value.trim())
    sent.value = true
    toast.add({
      severity: 'success',
      summary: t('auth.magicLinkSent'),
      detail: t('auth.magicLinkDetail'),
      life: 5000,
    })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: t('auth.toastTitle'),
      detail: authErrorMessage(e, 'common.error'),
      life: 6000,
    })
  } finally {
    busy.value = false
  }
}

async function loginDev() {
  if (!allowDevSession.value) return
  const trimmed = email.value.trim()
  if (!trimmed) {
    toast.add({
      severity: 'warn',
      summary: t('auth.devLoginTitle'),
      detail: t('settings.emailPlaceholder'),
      life: 2500,
    })
    return
  }
  busy.value = true
  try {
    await auth.signInWithDevSession(trimmed)
    try {
      localStorage.setItem(DEV_EMAIL_KEY, trimmed)
    } catch {
      /* ignore */
    }
    const workspace = useWorkspaceStore()
    await workspace.loadCurrent()
    await navigateTo(workspace.hasWorkspace ? '/' : '/onboarding')
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: t('auth.devLoginTitle'),
      detail: authErrorMessage(e, 'common.error'),
      life: 6000,
    })
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  if (import.meta.client && allowDevSession.value) {
    try {
      const saved = localStorage.getItem(DEV_EMAIL_KEY)?.trim()
      if (saved && !email.value) email.value = saved
    } catch {
      /* ignore */
    }
  }
  if (auth.isAuthenticated) {
    await navigateTo('/')
    return
  }
  // Silent Telegram login only inside real Mini App
  if (telegram.isTelegramEnvironment.value && telegram.getInitDataRaw()) {
    await loginTelegram()
  }
})
</script>

<template>
  <div class="app-page">
    <div class="login">
      <h1 class="app-page-title">{{ t('app.name') }}</h1>
      <p class="login__lead">{{ t('auth.lead') }}</p>

      <Button
        v-if="showTelegram"
        :label="t('auth.loginTelegram')"
        class="w-full"
        :loading="busy"
        @click="loginTelegram"
      />

      <p v-if="showTelegram && telegramFailed" class="login__tg-hint">
        {{ t('auth.telegramRetryHint') }}
      </p>

      <template v-if="showEmailForm">
        <form class="login__email" @submit.prevent="allowDevSession ? loginDev() : loginEmail()">
          <InputText
            v-model="email"
            type="email"
            class="w-full"
            :placeholder="t('settings.emailPlaceholder')"
            autocomplete="email"
          />
          <Button
            v-if="allowDevSession"
            type="submit"
            :label="t('auth.devLogin')"
            class="w-full"
            :loading="busy"
          />
          <Button
            type="button"
            :label="t('auth.sendMagicLink')"
            :severity="allowDevSession ? 'secondary' : undefined"
            class="w-full"
            :disabled="busy"
            :loading="busy && !allowDevSession"
            @click="loginEmail"
          />
        </form>

        <p v-if="allowDevSession" class="login__dev-hint">
          {{ t('auth.devHint') }}
        </p>
        <p v-if="sent" class="login__hint">{{ t('auth.checkEmailHint') }}</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.login {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-5);
  padding-top: var(--app-space-8);
  max-width: 22rem;
  margin-inline: auto;
  width: 100%;
}

.login :deep(.app-page-title),
.login .app-page-title {
  font-size: var(--app-text-2xl);
  letter-spacing: -0.04em;
}

.login__lead {
  margin: -0.5rem 0 0;
  color: var(--app-muted);
  font-size: var(--app-text-md);
  line-height: 1.4;
}

.login__email {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.login__hint {
  margin: 0;
  color: var(--app-success);
  font-size: var(--app-text-sm);
}

.login__dev-hint,
.login__tg-hint {
  margin: 0;
  color: var(--app-muted);
  font-size: var(--app-text-xs);
  line-height: 1.4;
}

.login__tg-hint {
  color: var(--app-accent-text);
}
</style>
