<script setup lang="ts">
import type { MemberRole } from '~~/shared/types'
import { MEMBER_ROLE_LABELS } from '~~/shared/types'
import { icons } from '~/utils/icons'

const workspace = useWorkspaceStore()
const auth = useAuthStore()
const { members, loading, error, fetchMembers, updateRole, removeMember } = useMembers()
const toast = useToast()
const confirm = useConfirm()
const { copy, copied } = useClipboard()
const { shareInvite, botUsername } = useInviteShare()

const roleOptions = (
  Object.entries(MEMBER_ROLE_LABELS) as [MemberRole, string][]
).map(([value, label]) => ({ value, label }))

onMounted(() => {
  void fetchMembers()
})

async function copyInviteCode() {
  if (!workspace.workspace) return
  await copy(workspace.workspace.inviteCode)
  toast.add({
    severity: 'success',
    summary: copied.value ? 'Код скопирован' : 'Скопировано',
    life: 2000,
  })
}

function inviteViaTelegram() {
  if (!workspace.workspace) return
  try {
    shareInvite(workspace.workspace.inviteCode, workspace.workspace.name)
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Приглашение',
      detail: e instanceof Error ? e.message : 'Не удалось открыть Telegram',
      life: 4000,
    })
  }
}

async function onRoleChange(memberId: string, role: MemberRole) {
  try {
    await updateRole(memberId, role)
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: e instanceof Error ? e.message : 'Не удалось сменить роль',
      life: 4000,
    })
    await fetchMembers()
  }
}

function confirmRemove(memberId: string, name: string) {
  confirm.require({
    message: `Удалить ${name} из команды?`,
    header: 'Участник',
    rejectLabel: 'Отмена',
    acceptLabel: 'Удалить',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await removeMember(memberId)
      } catch (e) {
        toast.add({
          severity: 'error',
          summary: 'Ошибка',
          detail: e instanceof Error ? e.message : 'Не удалось удалить',
          life: 4000,
        })
      }
    },
  })
}

function displayName(m: { displayName: string | null; userId: string }) {
  if (m.displayName) return m.displayName
  if (m.userId === auth.user?.id) return 'Вы'
  return 'Участник'
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase()
}
</script>

<template>
  <div class="app-page">
    <AppHeader title="Команда" :subtitle="workspace.workspace?.name" show-back back-to="/account" />

    <section v-if="workspace.canEditMembers" class="members-section">
      <h2 class="members-section__title">Приглашение</h2>
      <div class="invite-hero">
        <span class="invite-hero__pill">Код</span>
        <p class="invite-hero__code">{{ workspace.workspace?.inviteCode }}</p>
        <div class="invite-hero__actions">
          <button type="button" class="invite-btn invite-btn--ghost" @click="copyInviteCode">
            <AppIcon :name="icons.copy" size="1.1rem" />
            Копировать
          </button>
          <button
            type="button"
            class="invite-btn"
            :disabled="!botUsername"
            @click="inviteViaTelegram"
          >
            <AppIcon :name="icons.share" size="1.1rem" />
            В Telegram
          </button>
        </div>
      </div>
    </section>

    <AppLoading v-if="loading && !members.length" />
    <AppError v-else-if="error" :message="error" @retry="fetchMembers" />
    <AppEmptyState v-else-if="!members.length" title="Пока никого нет" />

    <section v-else class="members-section">
      <h2 class="members-section__title">Участники</h2>
      <div class="members-list">
        <article v-for="member in members" :key="member.id" class="member-card">
          <div class="member-card__avatar" aria-hidden="true">
            {{ initials(displayName(member)) }}
          </div>

          <div class="member-card__info">
            <div class="member-card__name-row">
              <p class="member-card__name">{{ displayName(member) }}</p>
              <span v-if="member.userId === auth.user?.id" class="member-card__you">Вы</span>
            </div>
            <span
              v-if="!workspace.canEditMembers"
              class="member-card__role"
            >
              {{ MEMBER_ROLE_LABELS[member.role] }}
            </span>
          </div>

          <div
            v-if="workspace.canEditMembers"
            class="member-card__controls"
            :class="{ 'member-card__controls--solo': member.userId === auth.user?.id }"
          >
            <Select
              class="member-card__role-select"
              :model-value="member.role"
              :options="roleOptions"
              option-label="label"
              option-value="value"
              :disabled="member.userId === auth.user?.id"
              @update:model-value="onRoleChange(member.id, $event as MemberRole)"
            />
            <button
              v-if="member.userId !== auth.user?.id"
              type="button"
              class="member-card__remove"
              aria-label="Удалить"
              @click="confirmRemove(member.id, displayName(member))"
            >
              <AppIcon :name="icons.trash" size="1.15rem" />
            </button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.members-section {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.members-section__title {
  margin: 0;
  font-size: var(--app-text-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--app-section-header);
}

.invite-hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--app-space-3);
  padding: var(--app-space-5);
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-left: 3px solid var(--app-accent);
}

.invite-hero__pill {
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

.invite-hero__code {
  margin: 0;
  font-size: var(--app-text-xl);
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--app-ink);
}

.invite-hero__actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: var(--app-space-2);
  width: 100%;
}

.invite-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--app-space-2);
  min-height: 2.5rem;
  width: 100%;
  padding: 0 0.75rem;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: var(--app-accent);
  color: var(--app-accent-contrast);
  font: inherit;
  font-weight: 600;
  font-size: var(--app-text-sm);
  white-space: nowrap;
  cursor: pointer;
}

.invite-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.invite-btn--ghost {
  background: transparent;
  color: var(--app-ink);
  border: 1px solid var(--app-border);
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.member-card {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  min-height: 3.75rem;
  padding: var(--app-space-3) var(--app-space-4);
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
}

.member-card__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
  font-size: var(--app-text-sm);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.member-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.member-card__name-row {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  min-width: 0;
}

.member-card__name {
  margin: 0;
  font-weight: 700;
  color: var(--app-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-card__you {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  min-height: 1.25rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--app-hover);
  color: var(--app-muted);
  font-size: var(--app-text-xs);
  font-weight: 700;
}

.member-card__role {
  margin: 0;
  font-size: var(--app-text-sm);
  color: var(--app-muted);
  font-weight: 500;
}

.member-card__controls {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 10.75rem 2.5rem;
  align-items: center;
  gap: var(--app-space-1);
  width: calc(10.75rem + 2.5rem + var(--app-space-1));
}

.member-card__controls--solo {
  grid-template-columns: 1fr;
}

.member-card__role-select,
.member-card__controls :deep(.p-select) {
  width: 100%;
  min-width: 0;
}

.member-card__controls :deep(.p-select) {
  height: 2.5rem;
}

.member-card__controls :deep(.p-select-label) {
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-inline-end: 0.15rem;
}

.member-card__controls :deep(.p-select-dropdown) {
  width: 1.75rem;
  flex: 0 0 1.75rem;
  justify-content: center;
}

.member-card__controls :deep(.p-select-dropdown-icon),
.member-card__controls :deep(.p-select-dropdown svg) {
  width: 0.75rem !important;
  height: 0.75rem !important;
  opacity: 0.72;
}

.member-card__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-destructive);
  cursor: pointer;
}
</style>
