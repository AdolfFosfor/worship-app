<script setup lang="ts">
import { authErrorMessage } from '~/utils/authError'

const auth = useAuthStore()
const telegram = useTelegramApp()
const toast = useToast()

const emailInput = ref('')
const busyEmail = ref(false)
const busyTelegram = ref(false)
const lastError = ref<string | null>(null)

const needsEmail = computed(() => !auth.user?.hasRealEmail)
const needsTelegram = computed(() => !auth.user?.telegramId)
const canLinkTelegramNow = computed(
  () => Boolean(telegram.getInitDataRaw()) || telegram.isMocked.value,
)

onMounted(() => {
  void auth.refreshUser()
})

async function submitEmail() {
  if (!emailInput.value.trim()) return
  busyEmail.value = true
  lastError.value = null
  try {
    await auth.linkEmail(emailInput.value.trim())
    emailInput.value = ''
    toast.add({
      severity: 'success',
      summary: 'Email привязан',
      detail: 'Можно входить из браузера этим адресом (Magic Link)',
      life: 5000,
    })
  } catch (e) {
    const detail = authErrorMessage(e, 'Не удалось привязать email')
    lastError.value = detail
    toast.add({
      severity: 'error',
      summary: 'Email',
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
      summary: 'Telegram',
      detail: 'Откройте приложение внутри Telegram, чтобы привязать аккаунт',
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
      summary: 'Telegram',
      detail: 'Аккаунт привязан — вход из Mini App и по email ведут в одни данные',
      life: 5000,
    })
  } catch (e) {
    const detail = authErrorMessage(e, 'Не удалось привязать Telegram')
    lastError.value = detail
    toast.add({
      severity: 'error',
      summary: 'Telegram',
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
    <AppHeader title="Настройки" show-back back-to="/account" />

    <p class="settings-lead">
      Привяжите email и Telegram к одному аккаунту — тогда браузер (Magic Link) и Mini App
      открывают одни и те же песни и сет-листы.
    </p>

    <section class="settings-block">
      <h2 class="settings-block__title">Email</h2>
      <template v-if="auth.user?.pendingEmail">
        <p class="settings-block__status">
          Ожидает подтверждения: <strong>{{ auth.user.pendingEmail }}</strong>
        </p>
        <p class="settings-block__hint">Проверьте почту и откройте ссылку на этом устройстве.</p>
      </template>
      <template v-else-if="auth.user?.hasRealEmail">
        <p class="settings-block__status">
          Привязан: <strong>{{ auth.user.email }}</strong>
        </p>
      </template>
      <form v-else class="settings-form" @submit.prevent="submitEmail">
        <label class="settings-field">
          <span>Рабочий email</span>
          <InputText
            v-model="emailInput"
            type="email"
            class="w-full"
            placeholder="you@church.org"
            autocomplete="email"
          />
        </label>
        <Button
          type="submit"
          label="Привязать email"
          class="w-full"
          :loading="busyEmail"
          :disabled="!emailInput.trim()"
        />
        <p class="settings-block__hint">
          Письмо для привязки не отправляется (лимит Supabase Free). Адрес сразу становится вашим
          логином: дальше в браузере — Magic Link на этот email.
        </p>
      </form>
      <p v-if="lastError" class="settings-block__error">{{ lastError }}</p>
    </section>

    <section class="settings-block">
      <h2 class="settings-block__title">Telegram</h2>
      <template v-if="auth.user?.telegramId">
        <p class="settings-block__status">
          Привязан:
          <strong>
            <template v-if="auth.user.username">@{{ auth.user.username }}</template>
            <template v-else>ID {{ auth.user.telegramId }}</template>
          </strong>
        </p>
      </template>
      <template v-else>
        <p v-if="!canLinkTelegramNow" class="settings-block__hint">
          Чтобы привязать Telegram, откройте это приложение внутри Telegram и нажмите кнопку ниже.
        </p>
        <Button
          label="Привязать Telegram"
          class="w-full"
          :loading="busyTelegram"
          :disabled="!canLinkTelegramNow"
          @click="submitTelegram"
        />
        <p v-if="needsEmail && needsTelegram" class="settings-block__hint">
          Если вы уже работали в Mini App под другим входом — сначала войдите там и привяжите email,
          либо привяжите Telegram здесь после входа по почте.
        </p>
      </template>
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
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
}

.settings-block__title {
  margin: 0;
  font-size: var(--app-text-sm);
  font-weight: 700;
  letter-spacing: 0.04em;
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
</style>
