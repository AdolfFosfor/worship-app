<script setup lang="ts">
/**
 * Песочница оверлеев: тосты, confirm и дальше другие всплывающие элементы.
 * В production редирект на /.
 */
definePageMeta({
  hideNav: false,
})

const toast = useToast()
const { requireDanger } = useAppConfirm()

onMounted(() => {
  if (!import.meta.dev) {
    void navigateTo('/')
  }
})

function showSuccess() {
  toast.add({
    severity: 'success',
    summary: 'Сохранено',
    life: 2500,
  })
}

function showSuccessDetail() {
  toast.add({
    severity: 'success',
    summary: 'Готово',
    detail: 'Песня добавлена в сет-лист «Воскресное служение».',
    life: 3500,
  })
}

function showError() {
  toast.add({
    severity: 'error',
    summary: 'Ошибка',
    detail: 'Не удалось сохранить. Проверьте сеть и попробуйте ещё раз.',
    life: 5000,
  })
}

function showInfo() {
  toast.add({
    severity: 'info',
    summary: 'Подсказка',
    detail: 'Фильтры сохраняются, пока вы не сбросите их.',
    life: 3500,
  })
}

function showWarn() {
  toast.add({
    severity: 'warn',
    summary: 'Внимание',
    detail: 'Изменения не сохранены. Уйдёте без сохранения?',
    life: 4000,
  })
}

function showLong() {
  toast.add({
    severity: 'error',
    summary: 'Длинное сообщение',
    detail:
      'Это длинный текст для проверки переносов и высоты тоста: не удалось обновить тональность, капо и схему аккордов из‑за конфликта версии. Обновите страницу и повторите.',
    life: 8000,
  })
}

function showStack() {
  toast.add({ severity: 'info', summary: 'Первый', detail: 'Стек из трёх', life: 6000 })
  toast.add({ severity: 'success', summary: 'Второй', detail: 'Идут друг за другом', life: 6000 })
  toast.add({ severity: 'error', summary: 'Третий', detail: 'Проверяем плотность', life: 6000 })
}

function showSticky() {
  toast.add({
    severity: 'warn',
    summary: 'Без автозакрытия',
    detail: 'Закройте крестиком или кнопкой «Очистить».',
    life: 0,
  })
}

function clearToasts() {
  toast.removeAllGroups()
}

function showConfirm() {
  requireDanger({
    title: 'Удалить песню?',
    message: 'Её нельзя будет вернуть из корзины — только создать заново.',
    acceptLabel: 'Удалить',
    accept: () => {
      toast.add({
        severity: 'success',
        summary: 'Удалено',
        life: 2000,
      })
    },
  })
}
useAppHeader({
  title: 'UI Lab',
  subtitle: 'Оверлеи и уведомления',
})
</script>

<template>
  <div class="app-page">
    <p class="ui-lab__lead">
      Песочница для переработки всплывающих окон. Сейчас — тосты и confirm.
      Шорткат: Option/Alt + T.
    </p>

    <section class="app-section">
      <h2 class="app-section__title">Тосты</h2>
      <div class="ui-lab__panel app-panel">
        <div class="ui-lab__grid">
          <button type="button" class="app-cta" @click="showSuccess">
            Success
          </button>
          <button type="button" class="app-cta" @click="showSuccessDetail">
            Success + detail
          </button>
          <button type="button" class="app-cta app-cta--danger" @click="showError">
            Error
          </button>
          <button type="button" class="app-cta app-cta--ghost" @click="showInfo">
            Info
          </button>
          <button type="button" class="app-cta app-cta--ghost" @click="showWarn">
            Warn
          </button>
          <button type="button" class="app-cta app-cta--ghost" @click="showLong">
            Длинный текст
          </button>
          <button type="button" class="app-cta app-cta--ghost" @click="showStack">
            Стек ×3
          </button>
          <button type="button" class="app-cta app-cta--ghost" @click="showSticky">
            Sticky
          </button>
          <button type="button" class="app-cta app-cta--ghost" @click="clearToasts">
            Очистить
          </button>
        </div>
      </div>
    </section>

    <section class="app-section">
      <h2 class="app-section__title">Confirm</h2>
      <div class="ui-lab__panel app-panel">
        <div class="ui-lab__grid">
          <button type="button" class="app-cta app-cta--danger" @click="showConfirm">
            Удаление
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ui-lab__lead {
  margin: 0;
  font-size: var(--app-text-sm);
  color: var(--app-muted);
  line-height: 1.45;
}

.ui-lab__panel {
  padding: var(--app-space-4);
}

.ui-lab__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.ui-lab__grid .app-cta {
  width: 100%;
}
</style>
