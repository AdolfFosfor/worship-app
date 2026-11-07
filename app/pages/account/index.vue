<script setup lang="ts">
import { icons } from '~/utils/icons'

const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()

const emailLabel = computed(() => {
  if (!auth.user) return '—'
  if (auth.user.pendingEmail) return `${auth.user.pendingEmail} (ожидает подтверждения)`
  if (auth.user.hasRealEmail && auth.user.email) return auth.user.email
  return 'Не привязан'
})

const telegramLabel = computed(() => {
  if (!auth.user?.telegramId) return 'Не привязан'
  if (auth.user.username) return `@${auth.user.username}`
  return `ID ${auth.user.telegramId}`
})

function confirmSignOut() {
  confirm.require({
    message: 'Выйти из аккаунта на этом устройстве?',
    header: 'Выход',
    rejectLabel: 'Отмена',
    acceptLabel: 'Выйти',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await auth.signOut()
        await navigateTo('/login')
      } catch (e) {
        toast.add({
          severity: 'error',
          summary: 'Выход',
          detail: e instanceof Error ? e.message : 'Ошибка',
          life: 4000,
        })
      }
    },
  })
}
</script>

<template>
  <div class="app-page">
    <AppHeader title="Аккаунт" show-back back-to="/" />

    <section class="account-card">
      <p class="account-card__name">{{ auth.displayLabel }}</p>
      <p class="account-card__meta">{{ emailLabel }}</p>
    </section>

    <AppSurfaceList>
      <AppListRow title="Email" :subtitle="emailLabel" />
      <AppListRow title="Telegram" :subtitle="telegramLabel" />
      <AppListRow
        title="Настройки"
        subtitle="Привязка email и Telegram"
        to="/account/settings"
        chevron
      />
    </AppSurfaceList>

    <button type="button" class="account-signout" @click="confirmSignOut">
      <AppIcon :name="icons.close" class="account-signout__icon" />
      Выйти
    </button>
  </div>
</template>

<style scoped>
.account-card {
  padding: var(--app-space-5);
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
}

.account-card__name {
  margin: 0;
  font-size: var(--app-text-lg);
  font-weight: 700;
  color: var(--app-ink);
}

.account-card__meta {
  margin: var(--app-space-2) 0 0;
  font-size: var(--app-text-sm);
  color: var(--app-muted);
  word-break: break-all;
}

.account-signout {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--app-space-2);
  min-height: var(--app-touch-min);
  width: 100%;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: var(--app-surface);
  color: var(--app-destructive);
  font-weight: 600;
  font-size: var(--app-text-md);
  cursor: pointer;
}

.account-signout__icon {
  width: 1.15rem;
  height: 1.15rem;
}
</style>
