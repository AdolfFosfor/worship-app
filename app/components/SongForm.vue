<script setup lang="ts">
import type { SongInput } from '~~/shared/types'
import { KEY_OPTIONS } from '~/utils/music/keys'

const props = defineProps<{
  modelValue: SongInput
  submitLabel?: string
  busy?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: SongInput]
  submit: []
}>()

const form = computed({
  get: () => props.modelValue,
  set: (value: SongInput) => emit('update:modelValue', value),
})

function patch<K extends keyof SongInput>(key: K, value: SongInput[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

const canSubmit = computed(() => props.modelValue.title.trim().length > 0 && Boolean(props.modelValue.key))
</script>

<template>
  <form class="song-form" @submit.prevent="canSubmit && !$props.busy && emit('submit')">
    <label class="song-form__field">
      <span>Название</span>
      <InputText
        :model-value="form.title"
        class="w-full"
        placeholder="Название песни"
        autofocus
        @update:model-value="patch('title', String($event ?? ''))"
      />
    </label>

    <label class="song-form__field">
      <span>Тональность</span>
      <Select
        :model-value="form.key"
        :options="KEY_OPTIONS"
        option-label="label"
        option-value="value"
        class="w-full"
        @update:model-value="patch('key', String($event))"
      />
    </label>

    <label class="song-form__field">
      <span>Аккорды / прогрессия</span>
      <Textarea
        :model-value="form.chords ?? ''"
        class="w-full"
        rows="5"
        auto-resize
        placeholder="G  D  Em  C"
        @update:model-value="patch('chords', String($event ?? '') || null)"
      />
    </label>

    <label class="song-form__field">
      <span>Текст (необязательно)</span>
      <Textarea
        :model-value="form.lyrics ?? ''"
        class="w-full"
        rows="6"
        auto-resize
        placeholder="Куплет / припев"
        @update:model-value="patch('lyrics', String($event ?? '') || null)"
      />
    </label>

    <label class="song-form__field">
      <span>YouTube (необязательно)</span>
      <InputText
        :model-value="form.youtubeUrl ?? ''"
        class="w-full"
        placeholder="https://youtube.com/…"
        @update:model-value="patch('youtubeUrl', String($event ?? '') || null)"
      />
    </label>

    <Button
      type="submit"
      class="w-full"
      :label="submitLabel ?? 'Сохранить'"
      :disabled="!canSubmit || busy"
      :loading="busy"
    />
  </form>
</template>

<style scoped>
.song-form {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.song-form__field {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  font-size: var(--app-text-sm);
  font-weight: 600;
  color: var(--app-section-header);
}

.song-form__field :deep(input),
.song-form__field :deep(textarea),
.song-form__field :deep(.p-select) {
  font-weight: 400;
  color: var(--app-ink);
}
</style>
