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
</script>

<template>
  <div class="app-page">
    <AppHeader title="Команда" :subtitle="workspace.workspace?.name" />

    <section v-if="workspace.canEditMembers" class="invite-card">
      <p class="invite-card__label">Приглашение</p>
      <p class="invite-card__code">{{ workspace.workspace?.inviteCode }}</p>
      <div class="invite-card__actions">
        <button type="button" class="invite-card__btn invite-card__btn--ghost" @click="copyInviteCode">
          <AppIcon :name="icons.copy" />
          Копировать код
        </button>
        <button
          type="button"
          class="invite-card__btn"
          :disabled="!botUsername"
          @click="inviteViaTelegram"
        >
          <AppIcon :name="icons.share" />
          Пригласить в Telegram
        </button>
      </div>
    </section>

    <AppLoading v-if="loading && !members.length" />
    <AppError v-else-if="error" :message="error" @retry="fetchMembers" />
    <AppEmptyState v-else-if="!members.length" title="Пока никого нет" />

    <div v-else class="members">
      <article v-for="member in members" :key="member.id" class="member">
        <div class="member__info">
          <p class="member__name">{{ displayName(member) }}</p>
          <p v-if="!workspace.canEditMembers" class="member__role">
            {{ MEMBER_ROLE_LABELS[member.role] }}
          </p>
        </div>
        <div class="member__controls">
          <Select
            v-if="workspace.canEditMembers"
            :model-value="member.role"
            :options="roleOptions"
            option-label="label"
            option-value="value"
            :disabled="member.userId === auth.user?.id"
            @update:model-value="onRoleChange(member.id, $event as MemberRole)"
          />
          <button
            v-if="workspace.canEditMembers && member.userId !== auth.user?.id"
            type="button"
            class="member__remove"
            aria-label="Удалить"
            @click="confirmRemove(member.id, displayName(member))"
          >
            <AppIcon :name="icons.trash" />
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.invite-card {
  padding: var(--app-space-4);
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.invite-card__label {
  margin: 0;
  font-size: var(--app-text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--app-section-header);
}

.invite-card__code {
  margin: 0;
  font-size: var(--app-text-xl);
  font-weight: 700;
  letter-spacing: 0.12em;
}

.invite-card__actions {
  margin-top: var(--app-space-2);
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
}

.invite-card__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--app-space-2);
  min-height: 2.5rem;
  padding: 0 0.9rem;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: var(--app-accent);
  color: var(--app-accent-contrast);
  font-weight: 600;
  cursor: pointer;
}

.invite-card__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.invite-card__btn--ghost {
  background: transparent;
  color: var(--app-ink);
  border: 1px solid var(--app-border);
}

.members {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.member {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-3) var(--app-space-4);
  border-radius: var(--app-radius);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
}

.member__name {
  margin: 0;
  font-weight: 700;
}

.member__role {
  margin: 0.15rem 0 0;
  font-size: var(--app-text-sm);
  color: var(--app-muted);
}

.member__controls {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
}

.member__remove {
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
