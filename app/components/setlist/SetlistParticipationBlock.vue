<script setup lang="ts">
import type { SetlistRsvpStatus, WorkspaceMember } from '~~/shared/types'

const props = defineProps<{
  setlistId: string
}>()

const workspace = useWorkspaceStore()
const auth = useAuthStore()
const toast = useToast()
const { t } = useAppLocale()
const { members, fetchMembers } = useMembers()
const {
  rsvps,
  loading,
  fetchRsvps,
  upsertOwnStatus,
  saving,
} = useSetlistRsvps(() => props.setlistId)

const detailOpen = ref(false)
const detailMemberId = ref<string | null>(null)

const statusOptions: { value: SetlistRsvpStatus; tone: string }[] = [
  { value: 'yes', tone: 'yes' },
  { value: 'maybe', tone: 'maybe' },
  { value: 'no', tone: 'no' },
]

const statusByMember = computed(() => {
  const map = new Map<string, SetlistRsvpStatus>()
  for (const r of rsvps.value) map.set(r.memberId, r.status)
  return map
})

const respondedCount = computed(() =>
  members.value.filter((m) => statusByMember.value.has(m.id)).length,
)

const ownMember = computed(() => {
  const uid = auth.user?.id
  if (!uid) return null
  return members.value.find((m) => m.userId === uid) ?? workspace.membership
})

const ownStatus = computed<SetlistRsvpStatus | null>(() => {
  const id = ownMember.value?.id
  if (!id) return null
  return statusByMember.value.get(id) ?? null
})

const detailMember = computed(() => {
  const id = detailMemberId.value
  if (!id) return null
  return members.value.find((m) => m.id === id) ?? null
})

const detailStatus = computed<SetlistRsvpStatus | null>(() => {
  const id = detailMemberId.value
  if (!id) return null
  return statusByMember.value.get(id) ?? null
})

const detailIsOwn = computed(() => {
  const member = detailMember.value
  if (!member || !auth.user) return false
  return member.userId === auth.user.id
})

onMounted(() => {
  void Promise.all([fetchMembers(), fetchRsvps()]).catch(() => {
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: t('setlist.rsvp.loadFailed'),
      life: 4000,
    })
  })
})

watch(
  () => props.setlistId,
  () => {
    void fetchRsvps().catch(() => {})
  },
)

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

function statusLabel(status: SetlistRsvpStatus | null) {
  if (status === 'yes') return t('setlist.rsvp.yes')
  if (status === 'maybe') return t('setlist.rsvp.maybe')
  if (status === 'no') return t('setlist.rsvp.no')
  return t('setlist.rsvp.pending')
}

function openDetail(member: WorkspaceMember) {
  detailMemberId.value = member.id
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  detailMemberId.value = null
}

async function selectStatus(status: SetlistRsvpStatus) {
  if (saving.value || ownStatus.value === status) return
  try {
    await upsertOwnStatus(status)
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: e instanceof Error ? e.message : t('setlist.rsvp.saveFailed'),
      life: 4000,
    })
    await fetchRsvps().catch(() => {})
  }
}
</script>

<template>
  <AppSection
    v-if="members.length || loading"
    class="setlist-rsvp"
    :title="t('setlist.rsvp.title')"
  >
    <div class="setlist-rsvp__panel app-panel">
      <div class="setlist-rsvp__head">
        <p class="setlist-rsvp__stats">
          {{ t('setlist.rsvp.responded', { answered: respondedCount, total: members.length }) }}
        </p>
      </div>

      <div
        class="setlist-rsvp__avatars"
        role="list"
        :aria-label="t('setlist.rsvp.title')"
      >
        <button
          v-for="member in members"
          :key="member.id"
          type="button"
          class="setlist-rsvp__avatar"
          role="listitem"
          :aria-label="`${displayName(member)}: ${statusLabel(statusByMember.get(member.id) ?? null)}`"
          @click="openDetail(member)"
        >
          <span class="setlist-rsvp__face" aria-hidden="true">
            <img
              v-if="member.avatarUrl"
              :src="member.avatarUrl"
              alt=""
              class="setlist-rsvp__photo"
              referrerpolicy="no-referrer"
            >
            <template v-else>{{ initials(displayName(member)) }}</template>
          </span>
          <span
            class="setlist-rsvp__dot"
            :class="`setlist-rsvp__dot--${statusByMember.get(member.id) ?? 'pending'}`"
            aria-hidden="true"
          />
        </button>
      </div>

      <div
        v-if="ownMember"
        class="setlist-rsvp__own"
        role="radiogroup"
        :aria-label="t('setlist.rsvp.yourStatus')"
      >
        <button
          v-for="opt in statusOptions"
          :key="opt.value"
          type="button"
          class="setlist-rsvp__choice"
          :class="{
            [`setlist-rsvp__choice--${opt.tone}`]: true,
            'setlist-rsvp__choice--on': ownStatus === opt.value,
          }"
          role="radio"
          :aria-checked="ownStatus === opt.value"
          :disabled="saving"
          @click="selectStatus(opt.value)"
        >
          {{ statusLabel(opt.value) }}
        </button>
      </div>
    </div>
  </AppSection>

  <Teleport to=".app-shell">
    <div
      v-if="detailOpen && detailMember"
      class="setlist-rsvp-sheet-mask"
      @click.self="closeDetail"
    >
      <div
        class="setlist-rsvp-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="displayName(detailMember)"
        @click.stop
      >
        <div class="setlist-rsvp-sheet__head">
          <div class="setlist-rsvp-sheet__avatar" aria-hidden="true">
            <img
              v-if="detailMember.avatarUrl"
              :src="detailMember.avatarUrl"
              alt=""
              class="setlist-rsvp-sheet__photo"
              referrerpolicy="no-referrer"
            >
            <template v-else>{{ initials(displayName(detailMember)) }}</template>
            <span
              class="setlist-rsvp-sheet__dot"
              :class="`setlist-rsvp__dot--${detailStatus ?? 'pending'}`"
            />
          </div>
          <div class="setlist-rsvp-sheet__copy">
            <p class="setlist-rsvp-sheet__name">
              {{ displayName(detailMember) }}
              <AppPill v-if="detailIsOwn" tone="muted" size="sm">{{ t('members.you') }}</AppPill>
            </p>
            <p class="setlist-rsvp-sheet__status">
              {{ statusLabel(detailStatus) }}
            </p>
          </div>
        </div>

        <div
          v-if="detailIsOwn"
          class="setlist-rsvp-sheet__choices"
          role="radiogroup"
          :aria-label="t('setlist.rsvp.yourStatus')"
        >
          <button
            v-for="opt in statusOptions"
            :key="opt.value"
            type="button"
            class="setlist-rsvp__choice"
            :class="{
              [`setlist-rsvp__choice--${opt.tone}`]: true,
              'setlist-rsvp__choice--on': ownStatus === opt.value,
            }"
            role="radio"
            :aria-checked="ownStatus === opt.value"
            :disabled="saving"
            @click="selectStatus(opt.value)"
          >
            {{ statusLabel(opt.value) }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.setlist-rsvp {
  margin-top: var(--app-space-4);
}

.setlist-rsvp__panel {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: var(--app-space-3) var(--app-space-4);
}

.setlist-rsvp__head {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.setlist-rsvp__stats {
  margin: 0;
  font-size: var(--app-text-sm);
  font-weight: 550;
  color: var(--app-muted);
  font-variant-numeric: tabular-nums;
}

.setlist-rsvp__avatars {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
}

.setlist-rsvp__avatar {
  position: relative;
  display: inline-flex;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.setlist-rsvp__face {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.setlist-rsvp__photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.setlist-rsvp__dot {
  position: absolute;
  right: -0.05rem;
  bottom: -0.05rem;
  width: 0.62rem;
  height: 0.62rem;
  border-radius: 999px;
  border: 2px solid var(--app-surface);
  background: var(--app-muted);
  box-sizing: border-box;
}

.setlist-rsvp__dot--yes {
  background: var(--app-success);
}

.setlist-rsvp__dot--maybe {
  background: var(--app-warn);
}

.setlist-rsvp__dot--no {
  background: var(--app-danger);
}

.setlist-rsvp__dot--pending {
  background: color-mix(in srgb, var(--app-muted) 70%, transparent);
}

.setlist-rsvp__own {
  display: flex;
  gap: var(--app-space-2);
}

.setlist-rsvp__choice {
  flex: 1;
  min-height: 2rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-pill);
  background: transparent;
  color: var(--app-ink);
  font: inherit;
  font-size: var(--app-text-sm);
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.setlist-rsvp__choice:disabled {
  opacity: 0.65;
}

.setlist-rsvp__choice--on.setlist-rsvp__choice--yes {
  border-color: color-mix(in srgb, var(--app-success) 45%, var(--app-border));
  background: color-mix(in srgb, var(--app-success) 16%, transparent);
  color: var(--app-success);
}

.setlist-rsvp__choice--on.setlist-rsvp__choice--maybe {
  border-color: color-mix(in srgb, var(--app-warn) 45%, var(--app-border));
  background: color-mix(in srgb, var(--app-warn) 16%, transparent);
  color: var(--app-warn);
}

.setlist-rsvp__choice--on.setlist-rsvp__choice--no {
  border-color: color-mix(in srgb, var(--app-danger) 45%, var(--app-border));
  background: color-mix(in srgb, var(--app-danger) 16%, transparent);
  color: var(--app-danger);
}
</style>

<style>
.setlist-rsvp-sheet-mask {
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

.setlist-rsvp-sheet {
  width: min(28rem, 100%);
  margin: 0;
  padding-top: var(--app-space-5);
  padding-bottom: calc(var(--app-space-4) + var(--app-safe-bottom));
  padding-left: max(var(--app-page-inline), var(--app-safe-left));
  padding-right: max(var(--app-page-inline), var(--app-safe-right));
  border-radius: 1.25rem 1.25rem 0 0;
  background: var(--app-surface);
  color: var(--app-ink);
  box-shadow: 0 -16px 40px color-mix(in srgb, #000 32%, transparent);
  cursor: default;
  animation: setlist-rsvp-sheet-enter 160ms cubic-bezier(0.32, 0.72, 0, 1);
}

.setlist-rsvp-sheet__head {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}

.setlist-rsvp-sheet__avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--app-accent-muted);
  color: var(--app-accent-text);
  font-size: var(--app-text-sm);
  font-weight: 700;
}

.setlist-rsvp-sheet__photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 999px;
}

.setlist-rsvp-sheet__dot {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 999px;
  border: 2px solid var(--app-surface);
  box-sizing: border-box;
}

.setlist-rsvp-sheet__copy {
  min-width: 0;
  flex: 1;
}

.setlist-rsvp-sheet__name {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  margin: 0;
  font-size: var(--app-text-lg);
  font-weight: 650;
  letter-spacing: -0.02em;
}

.setlist-rsvp-sheet__status {
  margin: 0.2rem 0 0;
  font-size: var(--app-text-sm);
  font-weight: 500;
  color: var(--app-muted);
}

.setlist-rsvp-sheet__choices {
  display: flex;
  gap: var(--app-space-2);
  margin-top: var(--app-space-5);
}

@keyframes setlist-rsvp-sheet-enter {
  from {
    transform: translateY(12%);
    opacity: 0.6;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
