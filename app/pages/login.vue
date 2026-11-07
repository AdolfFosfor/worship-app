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

const email = ref('adolffosfor@gmail.com')
const sent = ref(false)
const busy = ref(false)

/** Real Mini App only — browser mock uses Magic Link / dev session. */
const showTelegram = computed(() => telegram.isTelegramEnvironment.value)
const allowDevSession = computed(() => Boolean(config.public.allowTelegramDevMock))

async function loginTelegram() {
  busy.value = true
  try {
    const raw = telegram.getInitDataRaw()
    if (!raw) {
      throw new Error('Нет данных Telegram. Откройте приложение в Telegram или войдите по email.')
    }
    await auth.signInWithTelegram(raw)
    await navigateTo('/')
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Вход',
      detail: authErrorMessage(e, 'Ошибка входа'),
      life: 5000,
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
      summary: 'Письмо отправлено',
      detail: 'Откройте ссылку из письма на этом устройстве',
      life: 5000,
    })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Вход',
      detail: authErrorMessage(e, 'Ошибка'),
      life: 6000,
    })
  } finally {
    busy.value = false
  }
}

async function loginDev() {
  if (!email.value.trim()) return
  busy.value = true
  try {
    await auth.signInWithDevSession(email.value.trim())
    const workspace = useWorkspaceStore()
    await workspace.loadCurrent()
    await navigateTo(workspace.hasWorkspace ? '/' : '/onboarding')
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Dev-вход',
      detail: authErrorMessage(e, 'Ошибка'),
      life: 6000,
    })
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
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
      <h1 class="app-page-title">Worship</h1>
      <p class="login__lead">Войдите, чтобы открыть библиотеку команды</p>

      <Button
        v-if="showTelegram"
        label="Войти через Telegram"
        class="w-full"
        :loading="busy"
        @click="loginTelegram"
      />

      <div v-if="showTelegram" class="login__divider">или email</div>

      <form class="login__email" @submit.prevent="allowDevSession ? loginDev() : loginEmail()">
        <InputText
          v-model="email"
          type="email"
          class="w-full"
          placeholder="you@church.org"
          autocomplete="email"
        />
        <Button
          v-if="allowDevSession"
          type="submit"
          label="Войти без письма (dev)"
          class="w-full"
          :disabled="!email.trim()"
          :loading="busy"
        />
        <Button
          type="button"
          label="Отправить Magic Link"
          :severity="allowDevSession || showTelegram ? 'secondary' : undefined"
          class="w-full"
          :disabled="!email.trim() || busy"
          :loading="busy && !allowDevSession"
          @click="loginEmail"
        />
      </form>

      <p v-if="allowDevSession" class="login__dev-hint">
        Dev-режим: вход без письма, пока лимит Supabase Auth не сбросится.
      </p>
      <p v-if="sent" class="login__hint">Проверьте почту — ссылка для входа уже отправлена.</p>
    </div>
  </div>
</template>

<style scoped>
.login {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
  padding-top: var(--app-space-6);
}

.login__lead {
  margin: 0;
  color: var(--app-muted);
  font-size: var(--app-text-sm);
}

.login__divider {
  text-align: center;
  color: var(--app-muted);
  font-size: var(--app-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
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

.login__dev-hint {
  margin: 0;
  color: var(--app-muted);
  font-size: var(--app-text-xs);
  line-height: 1.4;
}
</style>
