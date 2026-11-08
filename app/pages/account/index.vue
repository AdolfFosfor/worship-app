<script setup lang="ts">
import { MEMBER_ROLE_LABELS } from '~~/shared/types'
import { icons } from '~/utils/icons'

const auth = useAuthStore()
const workspace = useWorkspaceStore()
const telegram = useTelegramApp()
const toast = useToast()
const confirm = useConfirm()
const { t } = useAppLocale()

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

const teamSubtitle = computed(() => {
  if (!workspace.workspace || !workspace.membership) return 'Нет команды'
  const role = MEMBER_ROLE_LABELS[workspace.membership.role]
  return `${workspace.workspace.name} · ${role}`
})

const photoUrl = computed(
  () => auth.user?.photoUrl || telegram.user.value?.photo_url || null,
)

const avatarInitials = computed(() => {
  const name = auth.displayLabel.trim()
  const parts = name.split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase()
})

const rolePill = computed(() => {
  if (!workspace.membership) return null
  return MEMBER_ROLE_LABELS[workspace.membership.role]
})

function confirmLeaveTeam() {
  const name = workspace.workspace?.name ?? 'команду'
  confirm.require({
    message: `Выйти из «${name}»? Песни и сет-листы команды останутся у других участников.`,
    header: 'Выход из команды',
    rejectLabel: 'Отмена',
    acceptLabel: 'Выйти из команды',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        const result = await workspace.leaveWorkspace()
        toast.add({
          severity: 'success',
          summary: 'Готово',
          detail: result.hasWorkspace ? 'Переключились на другую команду' : 'Вы вышли из команды',
          life: 2500,
        })
        await navigateTo(result.hasWorkspace ? '/' : '/onboarding')
      } catch (e) {
        toast.add({
          severity: 'error',
          summary: 'Команда',
          detail: e instanceof Error ? e.message : 'Ошибка',
          life: 4000,
        })
      }
    },
  })
}

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
    <AppHeader :title="t('account.title')" />

    <section class="account-hero">
      <div class="account-hero__avatar" aria-hidden="true">
        <img
          v-if="photoUrl"
          :src="photoUrl"
          alt=""
          class="account-hero__photo"
          referrerpolicy="no-referrer"
        >
        <span v-else>{{ avatarInitials }}</span>
      </div>
      <div class="account-hero__body">
        <p class="account-hero__name">{{ auth.displayLabel }}</p>
        <p class="account-hero__meta">{{ emailLabel }}</p>
        <div v-if="rolePill || telegramLabel !== 'Не привязан'" class="account-hero__pills">
          <span v-if="rolePill" class="account-hero__pill">{{ rolePill }}</span>
          <span
            v-if="telegramLabel !== 'Не привязан'"
            class="account-hero__pill account-hero__pill--muted"
          >
            {{ telegramLabel }}
          </span>
        </div>
      </div>
    </section>

    <AppSurfaceList>
      <AppListRow :title="t('account.team')" :subtitle="teamSubtitle" to="/members" chevron />
      <AppListRow title="Email" :subtitle="emailLabel" />
      <AppListRow title="Telegram" :subtitle="telegramLabel" />
      <AppListRow
        :title="t('account.settings')"
        :subtitle="t('account.settingsSubtitle')"
        to="/account/settings"
        chevron
      />
    </AppSurfaceList>

    <div class="account-actions">
      <button
        v-if="workspace.hasWorkspace"
        type="button"
        class="account-action account-action--leave"
        @click="confirmLeaveTeam"
      >
        <AppIcon :name="icons.users" class="account-action__icon" />
        Выйти из команды
      </button>

      <button
        type="button"
        class="account-action account-action--signout"
        @click="confirmSignOut"
      >
        <AppIcon :name="icons.close" class="account-action__icon" />
        Выйти из аккаунта
      </button>
    </div>
  </div>
</template>

<style scoped>
.account-hero {
  display: flex;
  align-items: center;
  gap: var(--app-space-4);
  padding: var(--app-space-5);
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-left: 3px solid var(--app-accent);
}

.account-hero__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 999px;
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
  font-size: var(--app-text-md);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.account-hero__photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.account-hero__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--app-space-1);
}

.account-hero__name {
  margin: 0;
  font-size: var(--app-text-lg);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--app-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-hero__meta {
  margin: 0;
  font-size: var(--app-text-sm);
  color: var(--app-muted);
  word-break: break-all;
}

.account-hero__pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
  margin-top: var(--app-space-1);
}

.account-hero__pill {
  display: inline-flex;
  align-items: center;
  min-height: 1.5rem;
  padding: 0 0.55rem;
  border-radius: 999px;
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
  font-size: var(--app-text-xs);
  font-weight: 700;
}

.account-hero__pill--muted {
  background: var(--app-hover);
  color: var(--app-muted);
}

.account-actions {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  margin-top: auto;
  padding-top: var(--app-space-4);
}

.account-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--app-space-2);
  min-height: var(--app-touch-min);
  width: 100%;
  border-radius: var(--app-radius);
  font: inherit;
  font-weight: 600;
  font-size: var(--app-text-md);
  cursor: pointer;
}

.account-action__icon {
  width: 1.15rem;
  height: 1.15rem;
}

.account-action--leave {
  border: 1px solid var(--app-border);
  background: var(--app-surface);
  color: var(--app-ink);
}

.account-action--signout {
  border: 1px solid color-mix(in srgb, var(--app-destructive) 35%, var(--app-border));
  background: color-mix(in srgb, var(--app-destructive) 14%, var(--app-surface));
  color: var(--app-destructive);
}
</style>
