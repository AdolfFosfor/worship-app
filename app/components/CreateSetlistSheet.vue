<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { localDayKey } from '~/utils/dates'
import { icons } from '~/utils/icons'

const open = defineModel<boolean>('open', { default: false })

const workspace = useWorkspaceStore()
const { t } = useAppLocale()
const { createSetlist } = useSetlists()
const toast = useToast()

const title = ref('')
const serviceDate = ref<Date>(new Date())
const busy = ref(false)

/** Держит soft KB в цепочке user-gesture до after-enter реального поля. */
const focusProxy = ref<HTMLInputElement | null>(null)
const titleInput = ref<ComponentPublicInstance | HTMLElement | null>(null)
const pendingFocus = ref(false)

function titleEl(): HTMLInputElement | null {
  const r = titleInput.value
  if (!r) return null
  if (r instanceof HTMLInputElement) return r
  const root = (r as ComponentPublicInstance).$el as HTMLElement | undefined
  if (root instanceof HTMLInputElement) return root
  return root?.querySelector?.('input') ?? null
}

function focusTitle() {
  const el = titleEl()
  if (!el) return
  el.focus({ preventScroll: true })
  el.select()
}

function resetForm() {
  title.value = t('setlists.defaultTitle')
  serviceDate.value = new Date()
  busy.value = false
}

/** Вызывать из клика — proxy-focus до монтирования sheet (iOS). */
function openSheet() {
  if (!workspace.canEditSetlists) return
  focusProxy.value?.focus({ preventScroll: true })
  pendingFocus.value = true
  resetForm()
  open.value = true
}

function close() {
  if (busy.value) return
  pendingFocus.value = false
  titleEl()?.blur()
  focusProxy.value?.blur()
  open.value = false
}

function onAfterEnter() {
  if (!pendingFocus.value) return
  pendingFocus.value = false
  void nextTick(() => {
    focusTitle()
    window.setTimeout(() => focusTitle(), 40)
  })
}

watch(open, (next) => {
  if (!next) {
    pendingFocus.value = false
    titleEl()?.blur()
    focusProxy.value?.blur()
    return
  }
  if (!workspace.canEditSetlists) {
    open.value = false
    return
  }
  // v-model без open() (?create=1) — без жеста, всё равно пробуем focus.
  if (!pendingFocus.value) {
    resetForm()
    pendingFocus.value = true
  }
})

async function save() {
  if (!title.value.trim() || !serviceDate.value || busy.value) return
  busy.value = true
  try {
    const setlist = await createSetlist({
      title: title.value.trim(),
      serviceDate: localDayKey(serviceDate.value),
    })
    toast.add({ severity: 'success', summary: t('common.created'), life: 2000 })
    pendingFocus.value = false
    open.value = false
    await navigateTo(`/setlists/${setlist.id}`)
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: e instanceof Error ? e.message : t('setlists.createFailed'),
      life: 4000,
    })
  } finally {
    busy.value = false
  }
}

defineExpose({
  open: openSheet,
  close,
})
</script>

<template>
  <Teleport to=".app-shell">
    <input
      ref="focusProxy"
      class="create-setlist-sheet__focus-proxy"
      type="text"
      tabindex="-1"
      aria-hidden="true"
      inputmode="text"
      autocomplete="off"
    >

    <Transition name="create-setlist-sheet" @after-enter="onAfterEnter">
      <div
        v-if="open"
        class="app-sheet create-setlist-sheet-mask"
        @click.self="close"
      >
        <div
          class="create-setlist-sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="t('setlists.newTitle')"
          @click.stop
        >
          <header class="create-setlist-sheet__head">
            <h2 class="create-setlist-sheet__title">{{ t('setlists.newTitle') }}</h2>
          </header>

          <form class="create-setlist-sheet__form" @submit.prevent="save">
            <label class="create-setlist-sheet__field">
              <span class="create-setlist-sheet__label">{{ t('setlists.fieldTitle') }}</span>
              <InputText
                ref="titleInput"
                v-model="title"
                class="w-full"
                autocomplete="off"
              />
            </label>

            <label class="create-setlist-sheet__field">
              <span class="create-setlist-sheet__label">{{ t('setlists.fieldDate') }}</span>
              <DatePicker
                v-model="serviceDate"
                date-format="dd.mm.yy"
                class="w-full"
                show-icon
                :manual-input="false"
              />
            </label>

            <button
              type="submit"
              class="create-setlist-sheet__submit"
              :disabled="busy || !title.trim() || !serviceDate"
            >
              <AppIcon v-if="!busy" :name="icons.add" size="1.15rem" />
              {{ busy ? t('common.saving') : t('common.create') }}
            </button>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.create-setlist-sheet__focus-proxy {
  position: fixed;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  opacity: 0;
  border: 0;
  padding: 0;
  margin: 0;
  pointer-events: none;
}

.create-setlist-sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
  padding-left: var(--app-safe-left);
  padding-right: var(--app-safe-right);
  background: color-mix(in srgb, #000 48%, transparent);
  cursor: pointer;
}

.create-setlist-sheet {
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
}

.create-setlist-sheet__head {
  margin-bottom: var(--app-space-4);
}

.create-setlist-sheet__title {
  margin: 0;
  font-size: var(--app-text-xl);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.2;
  color: var(--app-ink);
}

.create-setlist-sheet__form {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.create-setlist-sheet__field {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.create-setlist-sheet__label {
  font-size: var(--app-text-xs);
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--app-section-header);
}

.create-setlist-sheet__submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  min-height: 2.875rem;
  margin-top: var(--app-space-1);
  border: 0;
  border-radius: var(--app-radius-lg);
  background: var(--app-accent);
  color: var(--app-accent-contrast);
  font: inherit;
  font-weight: 650;
  cursor: pointer;
}

.create-setlist-sheet__submit:disabled {
  opacity: 0.55;
  cursor: wait;
}

.create-setlist-sheet-enter-active,
.create-setlist-sheet-leave-active {
  transition: opacity 160ms ease;
}

.create-setlist-sheet-enter-active .create-setlist-sheet,
.create-setlist-sheet-leave-active .create-setlist-sheet {
  transition: transform 160ms cubic-bezier(0.32, 0.72, 0, 1);
}

.create-setlist-sheet-enter-from,
.create-setlist-sheet-leave-to {
  opacity: 0;
}

.create-setlist-sheet-enter-from .create-setlist-sheet,
.create-setlist-sheet-leave-to .create-setlist-sheet {
  transform: translateY(100%);
}
</style>
