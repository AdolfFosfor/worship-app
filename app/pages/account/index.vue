<script setup lang="ts">
import type { MemberRole } from '~~/shared/types'
import { icons } from '~/utils/icons'

const auth = useAuthStore()
const workspace = useWorkspaceStore()
const telegram = useTelegramApp()
const toast = useToast()
const { requireDanger } = useAppConfirm()
const { t } = useAppLocale()

const unlinkedLabel = computed(() => t('account.unlinked'))

const emailLabel = computed(() => {
  if (!auth.user) return '—'
  if (auth.user.pendingEmail) {
    return `${auth.user.pendingEmail} ${t('account.emailPendingSuffix')}`
  }
  if (auth.user.hasRealEmail && auth.user.email) return auth.user.email
  return unlinkedLabel.value
})

const telegramLabel = computed(() => {
  if (!auth.user?.telegramId) return unlinkedLabel.value
  if (auth.user.username) return `@${auth.user.username}`
  return `ID ${auth.user.telegramId}`
})

function localizedRoleLabel(member: {
  role: MemberRole
  roleTitle?: string | null
}) {
  const title = member.roleTitle?.trim()
  if (title) return title
  return t(`members.role.${member.role}`)
}

const teamSubtitle = computed(() => {
  if (!workspace.workspace || !workspace.membership) return t('account.noTeam')
  const role = localizedRoleLabel(workspace.membership)
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
  return localizedRoleLabel(workspace.membership)
})

function confirmLeaveTeam() {
  const name = workspace.workspace?.name ?? t('account.team')
  requireDanger({
    title: t('account.leaveTeamConfirmTitle', { name }),
    message: t('account.leaveTeamConfirmMessage'),
    acceptLabel: t('account.leaveTeamAccept'),
    accept: async () => {
      try {
        const result = await workspace.leaveWorkspace()
        toast.add({
          severity: 'success',
          summary: t('common.done'),
          detail: result.hasWorkspace ? t('account.switchedTeam') : t('account.leftTeam'),
          life: 2500,
        })
        await navigateTo(result.hasWorkspace ? '/' : '/onboarding')
      } catch (e) {
        toast.add({
          severity: 'error',
          summary: t('account.team'),
          detail: e instanceof Error ? e.message : t('common.error'),
          life: 4000,
        })
      }
    },
  })
}

function confirmSignOut() {
  requireDanger({
    title: t('account.signOutConfirmTitle'),
    message: t('account.signOutConfirmMessage'),
    acceptLabel: t('account.signOutAccept'),
    accept: async () => {
      try {
        await auth.signOut()
        await navigateTo('/login')
      } catch (e) {
        toast.add({
          severity: 'error',
          summary: t('account.signOut'),
          detail: e instanceof Error ? e.message : t('common.error'),
          life: 4000,
        })
      }
    },
  })
}
useAppHeader(() => ({
  title: t('account.title'),
}))
</script>

<template>
  <div class="app-page">
    <section class="account-hero app-panel app-panel--accent">
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
        <div v-if="rolePill || telegramLabel !== unlinkedLabel" class="account-hero__pills">
          <AppPill v-if="rolePill">{{ rolePill }}</AppPill>
          <AppPill v-if="telegramLabel !== unlinkedLabel" tone="muted">
            {{ telegramLabel }}
          </AppPill>
        </div>
      </div>
    </section>

    <AppSurfaceList>
      <AppListRow :title="t('account.team')" :subtitle="teamSubtitle" to="/members" chevron />
      <AppListRow :title="t('settings.email')" :subtitle="emailLabel" />
      <AppListRow :title="t('settings.telegram')" :subtitle="telegramLabel" />
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
        {{ t('account.leaveTeam') }}
      </button>

      <button
        type="button"
        class="account-action account-action--signout"
        @click="confirmSignOut"
      >
        <AppIcon :name="icons.close" class="account-action__icon" />
        {{ t('account.signOut') }}
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
}

.account-hero__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.75rem;
  height: 3.75rem;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: var(--app-radius-pill);
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
  font-size: var(--app-text-xl);
  font-weight: 700;
  letter-spacing: -0.025em;
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
  border: 0;
  border-radius: var(--app-radius-lg);
  font: inherit;
  font-weight: 650;
  font-size: var(--app-text-md);
  letter-spacing: -0.01em;
  cursor: pointer;
}

.account-action__icon {
  width: 1.1rem;
  height: 1.1rem;
}

.account-action--leave {
  background: var(--app-surface);
  color: var(--app-ink);
}

.account-action--signout {
  background: color-mix(in srgb, var(--app-destructive) 12%, var(--app-surface));
  color: var(--app-destructive);
}
</style>
