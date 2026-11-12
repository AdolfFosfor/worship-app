<script setup lang="ts">
import type { MemberRole, WorkspaceMember } from '~~/shared/types'
import { icons } from '~/utils/icons'

const workspace = useWorkspaceStore()
const auth = useAuthStore()
const { members, loading, error, fetchMembers, updateRole, removeMember } = useMembers()
const toast = useToast()
const { requireDanger } = useAppConfirm()
const { copy } = useClipboard()
const { shareInvite, botUsername } = useInviteShare()
const { t } = useAppLocale()

const memberRoles: MemberRole[] = ['administrator', 'worship_leader', 'musician']

const roleOptions = computed(() =>
  memberRoles.map((value) => ({ value, label: t(`members.role.${value}`) })),
)

const editorOpen = ref(false)
const editorMemberId = ref<string | null>(null)
const draftRole = ref<MemberRole>('musician')
const draftTitle = ref('')
const saving = ref(false)

const editorMember = computed(() => {
  const id = editorMemberId.value
  if (!id) return null
  return members.value.find((member) => member.id === id) ?? null
})

const titlePlaceholder = computed(() => t(`members.role.${draftRole.value}`))

function localizedRoleLabel(member: {
  role: MemberRole
  roleTitle?: string | null
}) {
  const title = member.roleTitle?.trim()
  if (title) return title
  return t(`members.role.${member.role}`)
}

onMounted(() => {
  void fetchMembers()
})

async function copyInviteCode() {
  if (!workspace.workspace) return
  await copy(workspace.workspace.inviteCode)
  toast.add({
    severity: 'success',
    summary: t('members.codeCopied'),
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
      summary: t('members.invite'),
      detail: e instanceof Error ? e.message : t('members.telegramOpenFailed'),
      life: 4000,
    })
  }
}

function openEditor(member: WorkspaceMember) {
  if (!workspace.canEditMembers || isOwn(member)) return
  editorMemberId.value = member.id
  draftRole.value = member.role
  draftTitle.value = member.roleTitle ?? ''
  editorOpen.value = true
}

function closeEditor() {
  editorOpen.value = false
  editorMemberId.value = null
  draftTitle.value = ''
  saving.value = false
}

async function saveEditor() {
  const member = editorMember.value
  if (!member || saving.value) return
  saving.value = true
  try {
    await updateRole(member.id, draftRole.value, draftTitle.value)
    closeEditor()
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: e instanceof Error ? e.message : t('common.saveFailed'),
      life: 4000,
    })
    await fetchMembers()
  } finally {
    saving.value = false
  }
}

function confirmRemoveFromEditor() {
  const member = editorMember.value
  if (!member) return
  const name = displayName(member)
  requireDanger({
    title: t('members.removeConfirmTitle', { name }),
    message: t('members.removeConfirmMessage'),
    acceptLabel: t('common.delete'),
    accept: async () => {
      try {
        await removeMember(member.id)
        closeEditor()
      } catch (e) {
        toast.add({
          severity: 'error',
          summary: t('common.error'),
          detail: e instanceof Error ? e.message : t('common.deleteFailed'),
          life: 4000,
        })
      }
    },
  })
}

function displayName(m: { displayName: string | null; userId: string }) {
  if (m.displayName) return m.displayName
  if (m.userId === auth.user?.id) return t('members.you')
  return t('members.guestName')
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase()
}

function isOwn(member: WorkspaceMember) {
  return member.userId === auth.user?.id
}
useAppHeader(() => ({
  title: t('members.title'),
  subtitle: workspace.workspace?.name ?? null,
}))
</script>

<template>
  <div class="app-page">
    <AppSection v-if="workspace.canEditMembers" :title="t('members.inviteSection')">
      <div class="invite-hero app-panel app-panel--accent">
        <AppPill>{{ t('members.code') }}</AppPill>
        <p class="invite-hero__code">{{ workspace.workspace?.inviteCode }}</p>
        <div class="invite-hero__actions">
          <button type="button" class="invite-btn invite-btn--ghost" @click="copyInviteCode">
            <AppIcon :name="icons.copy" size="1.05rem" />
            {{ t('members.copy') }}
          </button>
          <button
            type="button"
            class="invite-btn"
            :disabled="!botUsername"
            @click="inviteViaTelegram"
          >
            <AppIcon :name="icons.share" size="1.05rem" />
            {{ t('members.shareTelegram') }}
          </button>
        </div>
      </div>
    </AppSection>

    <AppSection v-if="loading && !members.length" :title="t('members.sectionList')">
      <SkeletonListRows :rows="5" />
    </AppSection>
    <AppError v-else-if="error" :message="error" @retry="fetchMembers" />
    <AppEmptyState v-else-if="!members.length" :title="t('members.empty')" />

    <AppSection v-else :title="t('members.sectionList')">
      <div class="members-list app-panel">
        <div
          v-for="member in members"
          :key="member.id"
          class="member-row"
          :class="{ 'member-row--action': workspace.canEditMembers && !isOwn(member) }"
          :role="workspace.canEditMembers && !isOwn(member) ? 'button' : undefined"
          :tabindex="workspace.canEditMembers && !isOwn(member) ? 0 : undefined"
          @click="openEditor(member)"
          @keydown.enter.prevent="openEditor(member)"
          @keydown.space.prevent="openEditor(member)"
        >
          <div class="member-row__avatar" aria-hidden="true">
            <img
              v-if="member.avatarUrl"
              :src="member.avatarUrl"
              alt=""
              class="member-row__photo"
              referrerpolicy="no-referrer"
            >
            <template v-else>{{ initials(displayName(member)) }}</template>
          </div>

          <div class="member-row__body">
            <div class="member-row__name-row">
              <p class="member-row__name">{{ displayName(member) }}</p>
              <AppPill v-if="isOwn(member)" tone="muted" size="sm">{{ t('members.you') }}</AppPill>
            </div>
            <p class="member-row__role">{{ localizedRoleLabel(member) }}</p>
          </div>

          <AppIcon
            v-if="workspace.canEditMembers && !isOwn(member)"
            :name="icons.chevronRight"
            class="member-row__chevron"
            size="1.05rem"
          />
        </div>
      </div>
    </AppSection>

    <Teleport to=".app-shell">
      <div
        v-if="editorOpen && editorMember"
        class="member-sheet-mask"
        @click.self="closeEditor"
      >
        <div
          class="member-sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="t('members.roleAria', { role: displayName(editorMember) })"
          @click.stop
        >
          <div class="member-sheet__head">
            <div class="member-sheet__avatar" aria-hidden="true">
              <img
                v-if="editorMember.avatarUrl"
                :src="editorMember.avatarUrl"
                alt=""
                class="member-sheet__photo"
                referrerpolicy="no-referrer"
              >
              <template v-else>{{ initials(displayName(editorMember)) }}</template>
            </div>
            <div class="member-sheet__head-copy">
              <p class="member-sheet__title">{{ displayName(editorMember) }}</p>
              <p class="member-sheet__subtitle">{{ t('members.roleSubtitle') }}</p>
            </div>
          </div>

          <div class="member-sheet__roles" role="radiogroup" :aria-label="t('members.roleGroupAria')">
            <button
              v-for="opt in roleOptions"
              :key="opt.value"
              type="button"
              class="member-sheet__role"
              :class="{ 'member-sheet__role--on': draftRole === opt.value }"
              role="radio"
              :aria-checked="draftRole === opt.value"
              @click="draftRole = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>

          <label class="member-sheet__field">
            <span class="member-sheet__label">{{ t('members.displayAsLabel') }}</span>
            <InputText
              v-model="draftTitle"
              class="w-full"
              :placeholder="titlePlaceholder"
              maxlength="40"
              autocomplete="off"
            />
            <span class="member-sheet__hint">
              {{ t('members.displayAsHint') }}
            </span>
          </label>

          <div class="member-sheet__actions">
            <button
              type="button"
              class="member-sheet__save"
              :disabled="saving"
              @click="saveEditor"
            >
              {{ saving ? t('common.saving') : t('common.done') }}
            </button>
            <button
              type="button"
              class="member-sheet__remove"
              :disabled="saving"
              @click="confirmRemoveFromEditor"
            >
              {{ t('members.removeFromTeam') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.invite-hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--app-space-3);
  padding: var(--app-space-5);
}

.invite-hero__code {
  margin: 0;
  font-size: var(--app-text-2xl);
  font-weight: 700;
  letter-spacing: 0.12em;
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
  border-radius: var(--app-radius-pill);
  background: var(--app-accent);
  color: var(--app-accent-contrast);
  font: inherit;
  font-weight: 650;
  font-size: var(--app-text-sm);
  letter-spacing: -0.01em;
  white-space: nowrap;
  cursor: pointer;
}

.invite-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.invite-btn--ghost {
  background: var(--app-hover);
  color: var(--app-ink);
}

.members-list {
  display: flex;
  flex-direction: column;
}

.member-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  width: 100%;
  min-height: 3.75rem;
  padding: 0.85rem var(--app-page-inline);
  border: 0 !important;
  outline: none !important;
  box-shadow: none !important;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  transition: background-color var(--app-duration) var(--app-ease);
}

.member-row--action {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.member-row--action:hover,
.member-row--action:focus,
.member-row--action:focus-visible,
.member-row--action:active {
  border: 0 !important;
  outline: none !important;
  box-shadow: none !important;
}

@media (hover: hover) and (pointer: fine) {
  .member-row--action:hover {
    background: color-mix(in srgb, var(--app-ink) 3.5%, transparent);
  }
}

.member-row--action:active {
  background: color-mix(in srgb, var(--app-ink) 5%, transparent);
}

.member-row:not(:last-child)::after {
  content: '';
  position: absolute;
  left: calc(var(--app-space-4) + 2.5rem + var(--app-space-3));
  right: 0;
  bottom: 0;
  height: var(--app-hairline);
  background: var(--app-border);
  pointer-events: none;
}

.member-row__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 999px;
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
  font-size: var(--app-text-sm);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.member-row__photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.member-row__body {
  flex: 1;
  min-width: 0;
}

.member-row__name-row {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  min-width: 0;
}

.member-row__name {
  margin: 0;
  font-size: var(--app-text-lg);
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--app-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-row__role {
  margin: 0.15rem 0 0;
  font-size: var(--app-text-sm);
  font-weight: 450;
  color: var(--app-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-row__chevron {
  flex-shrink: 0;
  color: var(--app-muted);
  opacity: 0.45;
}
</style>

<style>
.member-sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
  background: color-mix(in srgb, #000 48%, transparent);
  cursor: pointer;
}

.member-sheet {
  width: min(28rem, 100%);
  margin: 0;
  padding:
    var(--app-space-5)
    var(--app-space-4)
    calc(var(--app-space-4) + var(--app-safe-bottom));
  border-radius: 1.25rem 1.25rem 0 0;
  background: var(--app-surface);
  color: var(--app-ink);
  box-shadow: 0 -16px 40px color-mix(in srgb, #000 32%, transparent);
  cursor: default;
  animation: member-sheet-enter 160ms cubic-bezier(0.32, 0.72, 0, 1);
}

.member-sheet__head {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  margin-bottom: var(--app-space-5);
}

.member-sheet__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 999px;
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
  font-size: var(--app-text-sm);
  font-weight: 700;
}

.member-sheet__photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.member-sheet__head-copy {
  min-width: 0;
}

.member-sheet__title {
  margin: 0;
  font-size: var(--app-text-lg);
  font-weight: 700;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-sheet__subtitle {
  margin: 0.15rem 0 0;
  font-size: var(--app-text-sm);
  color: var(--app-muted);
}

.member-sheet__roles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.35rem;
  margin-bottom: var(--app-space-4);
  padding: 0.3rem;
  border-radius: var(--app-radius-lg);
  background: var(--app-hover);
}

.member-sheet__role {
  min-height: 2.35rem;
  padding: 0 0.35rem;
  border: 0;
  border-radius: var(--app-radius);
  background: transparent;
  color: var(--app-muted);
  font: inherit;
  font-size: var(--app-text-sm);
  font-weight: 650;
  letter-spacing: -0.01em;
  cursor: pointer;
}

.member-sheet__role--on {
  background: var(--app-surface);
  color: var(--app-ink);
  box-shadow: var(--app-shadow-soft);
}

.member-sheet__field {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  margin-bottom: var(--app-space-5);
}

.member-sheet__label {
  font-size: var(--app-text-xs);
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--app-section-header);
}

.member-sheet__hint {
  font-size: var(--app-text-xs);
  color: var(--app-muted);
}

.member-sheet__actions {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.member-sheet__save,
.member-sheet__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: var(--app-touch-min);
  border: 0;
  border-radius: var(--app-radius-lg);
  font: inherit;
  font-weight: 650;
  cursor: pointer;
}

.member-sheet__save {
  background: var(--app-accent);
  color: var(--app-accent-contrast);
}

.member-sheet__save:disabled,
.member-sheet__remove:disabled {
  opacity: 0.55;
  cursor: wait;
}

.member-sheet__remove {
  background: transparent;
  color: var(--app-destructive);
}

@keyframes member-sheet-enter {
  from {
    transform: translateY(100%);
  }
}
</style>
