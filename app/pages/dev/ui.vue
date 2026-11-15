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
      <p class="ui-lab__hint">
        Над панелью — статичный success «Сохранено» для правок стилей.
        Живые тосты: крестик или свайп вверх (как iOS).
      </p>

      <!--
        Статичный мок success-тоста (DOM как у живого PrimeVue Toast).
        Правьте .p-toast в layouts/default.vue — блок не исчезает.
      -->
      <div
        class="p-toast p-component p-toast-top-center ui-lab-toast-fixture"
        data-pc-name="toast"
        data-pc-section="root"
        aria-live="polite"
      >
        <div>
          <div
            class="p-toast-message p-toast-message-success"
            data-pc-section="message"
          >
            <div class="p-toast-message-content" data-pc-section="messagecontent">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                class="p-icon p-toast-message-icon"
                aria-hidden="true"
                data-pc-section="messageicon"
              >
                <path
                  d="M4.86199 11.5948C4.78717 11.5923 4.71366 11.5745 4.64596 11.5426C4.57826 11.5107 4.51779 11.4652 4.46827 11.4091L0.753985 7.69483C0.683167 7.64891 0.623706 7.58751 0.580092 7.51525C0.536478 7.44299 0.509851 7.36177 0.502221 7.27771C0.49459 7.19366 0.506156 7.10897 0.536046 7.03004C0.565935 6.95111 0.613367 6.88 0.674759 6.82208C0.736151 6.76416 0.8099 6.72095 0.890436 6.69571C0.970973 6.67046 1.05619 6.66385 1.13966 6.67635C1.22313 6.68886 1.30266 6.72017 1.37226 6.76792C1.44186 6.81567 1.4997 6.8786 1.54141 6.95197L4.86199 10.2503L12.6397 2.49483C12.7444 2.42694 12.8689 2.39617 12.9932 2.40745C13.1174 2.41873 13.2343 2.47141 13.3251 2.55705C13.4159 2.64268 13.4753 2.75632 13.4938 2.87973C13.5123 3.00315 13.4888 3.1292 13.4271 3.23768L5.2557 11.4091C5.20618 11.4652 5.14571 11.5107 5.07801 11.5426C5.01031 11.5745 4.9368 11.5923 4.86199 11.5948Z"
                  fill="currentColor"
                />
              </svg>
              <div class="p-toast-message-text" data-pc-section="messagetext">
                <span class="p-toast-summary" data-pc-section="summary">Сохранено</span>
              </div>
              <div data-pc-section="buttoncontainer">
                <button
                  type="button"
                  class="p-toast-close-button"
                  data-pc-section="closebutton"
                  aria-label="Закрыть"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    class="p-icon p-toast-close-icon"
                    aria-hidden="true"
                    data-pc-section="closeicon"
                  >
                    <path
                      d="M8.01186 7.00933L12.27 2.75116C12.341 2.68501 12.398 2.60524 12.4375 2.51661C12.4769 2.42798 12.4982 2.3323 12.4999 2.23529C12.5016 2.13827 12.4838 2.0419 12.4474 1.95194C12.4111 1.86197 12.357 1.78024 12.2884 1.71163C12.2198 1.64302 12.138 1.58893 12.0481 1.55259C11.9581 1.51625 11.8617 1.4984 11.7647 1.50011C11.6677 1.50182 11.572 1.52306 11.4834 1.56255C11.3948 1.60204 11.315 1.65898 11.2488 1.72997L6.99067 5.98814L2.7325 1.72997C2.59553 1.60234 2.41437 1.53286 2.22718 1.53616C2.03999 1.53946 1.8614 1.61529 1.72901 1.74767C1.59663 1.88006 1.5208 2.05865 1.5175 2.24584C1.5142 2.43303 1.58368 2.61419 1.71131 2.75116L5.96948 7.00933L1.71131 11.2675C1.576 11.403 1.5 11.5866 1.5 11.7781C1.5 11.9696 1.576 12.1532 1.71131 12.2887C1.84679 12.424 2.03043 12.5 2.2219 12.5C2.41338 12.5 2.59702 12.424 2.7325 12.2887L6.99067 8.03052L11.2488 12.2887C11.3843 12.424 11.568 12.5 11.7594 12.5C11.9509 12.5 12.1346 12.424 12.27 12.2887C12.4053 12.1532 12.4813 11.9696 12.4813 11.7781C12.4813 11.5866 12.4053 11.403 12.27 11.2675L8.01186 7.00933Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

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

.ui-lab__hint {
  margin: 0 0 var(--app-space-2);
  font-size: var(--app-text-xs);
  color: var(--app-muted);
}

/* Фикстура в потоке страницы — без fixed/Teleport */
.ui-lab-toast-fixture.p-toast {
  position: static !important;
  top: auto !important;
  left: auto !important;
  right: auto !important;
  transform: none !important;
  width: 100% !important;
  margin: 0 0 var(--app-space-3);
  z-index: auto !important;
  pointer-events: auto;
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
