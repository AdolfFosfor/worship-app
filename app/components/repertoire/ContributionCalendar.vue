<script setup lang="ts">
import type { RepertoireActivityDay } from '~~/shared/types'
import {
  buildContributionGrid,
  type ContributionCell,
} from '~/utils/repertoire/calendar'

const props = withDefaults(
  defineProps<{
    from: string
    to: string
    activity: RepertoireActivityDay[]
    compact?: boolean
    interactive?: boolean
  }>(),
  {
    compact: false,
    interactive: true,
  },
)

const emit = defineEmits<{
  select: [day: ContributionCell]
}>()

const { t, locale } = useAppLocale()

const grid = computed(() =>
  buildContributionGrid(props.from, props.to, props.activity),
)

const weekCount = computed(() => grid.value.weeks.length)

const monthLabels = computed(() => {
  const tag = ({ ru: 'ru-RU', ro: 'ro-RO', en: 'en-GB' } as const)[locale.value] ?? 'en-GB'
  const labels: { weekIndex: number; label: string }[] = []
  let lastMonth = -1
  grid.value.weeks.forEach((week, weekIndex) => {
    const firstReal = week.days.find((d) => !d.empty)
    if (!firstReal) return
    const date = new Date(`${firstReal.date}T12:00:00`)
    const month = date.getMonth()
    if (month === lastMonth) return
    // Не клеим подписи слишком близко
    const prev = labels[labels.length - 1]
    if (prev && weekIndex - prev.weekIndex < 3) return
    lastMonth = month
    labels.push({
      weekIndex,
      label: new Intl.DateTimeFormat(tag, { month: 'short' }).format(date),
    })
  })
  return labels
})

const weekdayLabels = computed(() => {
  const tag = ({ ru: 'ru-RU', ro: 'ro-RO', en: 'en-GB' } as const)[locale.value] ?? 'en-GB'
  // Пн / Ср / Пт
  const monday = new Date('2024-01-01T12:00:00') // Monday
  return [0, 2, 4].map((offset) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + offset)
    return {
      row: offset,
      label: new Intl.DateTimeFormat(tag, { weekday: 'narrow' }).format(d),
    }
  })
})

function onCellClick(cell: ContributionCell) {
  if (!props.interactive || cell.empty || cell.count <= 0) return
  emit('select', cell)
}

function cellTitle(cell: ContributionCell) {
  if (cell.empty || cell.count <= 0) return undefined
  return t('repertoire.calendarDayCount', { count: cell.count, date: cell.date })
}

const scrollEl = ref<HTMLElement | null>(null)

function scrollToRecent() {
  const el = scrollEl.value
  if (!el) return
  el.scrollLeft = el.scrollWidth
}

onMounted(() => {
  void nextTick(() => scrollToRecent())
})

watch(weekCount, () => {
  void nextTick(() => scrollToRecent())
})
</script>

<template>
  <div
    class="contrib"
    :class="{ 'contrib--compact': compact }"
    role="img"
    :aria-label="t('repertoire.calendarAria')"
  >
    <div
      ref="scrollEl"
      class="contrib__scroll"
      :style="{ '--contrib-weeks': String(weekCount) }"
    >
      <div class="contrib__frame">
        <div class="contrib__months" aria-hidden="true">
          <span
            v-for="m in monthLabels"
            :key="`${m.weekIndex}-${m.label}`"
            class="contrib__month"
            :style="{
              transform: `translateX(calc(${m.weekIndex} * (var(--contrib-size) + var(--contrib-gap))))`,
            }"
          >
            {{ m.label }}
          </span>
        </div>

        <div class="contrib__body">
          <div class="contrib__weekdays" aria-hidden="true">
            <span
              v-for="wd in weekdayLabels"
              :key="wd.row"
              class="contrib__weekday"
              :style="{ gridRow: wd.row + 1 }"
            >
              {{ wd.label }}
            </span>
          </div>

          <div class="contrib__weeks">
            <div
              v-for="(week, wi) in grid.weeks"
              :key="wi"
              class="contrib__week"
            >
              <button
                v-for="cell in week.days"
                :key="cell.date"
                type="button"
                class="contrib__cell"
                :class="[
                  `contrib__cell--l${cell.level}`,
                  {
                    'contrib__cell--empty': cell.empty,
                    'contrib__cell--hot': !cell.empty && cell.count > 0,
                  },
                ]"
                :disabled="!interactive || cell.empty || cell.count <= 0"
                :title="cellTitle(cell)"
                :aria-label="cellTitle(cell)"
                :aria-hidden="cell.empty || cell.count <= 0 ? true : undefined"
                @click="onCellClick(cell)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!compact" class="contrib__legend" aria-hidden="true">
      <span class="contrib__legend-label">{{ t('repertoire.calendarLess') }}</span>
      <span class="contrib__cell contrib__cell--l0 contrib__cell--legend" />
      <span class="contrib__cell contrib__cell--l1 contrib__cell--legend" />
      <span class="contrib__cell contrib__cell--l2 contrib__cell--legend" />
      <span class="contrib__cell contrib__cell--l3 contrib__cell--legend" />
      <span class="contrib__cell contrib__cell--l4 contrib__cell--legend" />
      <span class="contrib__legend-label">{{ t('repertoire.calendarMore') }}</span>
    </div>
  </div>
</template>

<style scoped>
.contrib {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  min-width: 0;
}

.contrib__scroll {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 0.15rem;
  scrollbar-width: thin;
  --contrib-size: 0.62rem;
  --contrib-gap: 0.18rem;
}

.contrib--compact .contrib__scroll {
  --contrib-size: 0.48rem;
  --contrib-gap: 0.14rem;
}

.contrib__frame {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: max-content;
}

.contrib__months {
  position: relative;
  height: 0.75rem;
  margin-left: 1.05rem;
}

.contrib__month {
  position: absolute;
  top: 0;
  left: 0;
  font-size: var(--app-text-2xs);
  font-weight: 550;
  color: var(--app-muted);
  line-height: 1;
  white-space: nowrap;
}

.contrib__body {
  display: grid;
  grid-template-columns: 0.85rem max-content;
  column-gap: 0.2rem;
  min-width: max-content;
}

.contrib--compact .contrib__months {
  display: none;
}

.contrib__weekdays {
  display: grid;
  grid-template-rows: repeat(7, var(--contrib-size));
  row-gap: var(--contrib-gap);
  align-items: center;
}

.contrib__weekday {
  font-size: 0.55rem;
  line-height: 1;
  color: var(--app-faint);
  text-align: center;
}

.contrib--compact .contrib__weekdays {
  display: none;
}

.contrib--compact .contrib__body {
  grid-template-columns: max-content;
}

.contrib__weeks {
  display: flex;
  gap: var(--contrib-gap);
}

.contrib__week {
  display: grid;
  grid-template-rows: repeat(7, var(--contrib-size));
  row-gap: var(--contrib-gap);
}

.contrib__cell {
  width: var(--contrib-size);
  height: var(--contrib-size);
  padding: 0;
  border: none;
  border-radius: 0.15rem;
  background: color-mix(in srgb, var(--app-ink) 8%, transparent);
  cursor: default;
  appearance: none;
  -webkit-appearance: none;
}

.contrib__cell--hot {
  cursor: pointer;
}

.contrib__cell--hot:active {
  transform: scale(0.92);
}

.contrib__cell--empty {
  opacity: 0;
  pointer-events: none;
}

.contrib__cell--l1 {
  background: color-mix(in srgb, var(--app-accent) 28%, transparent);
}

.contrib__cell--l2 {
  background: color-mix(in srgb, var(--app-accent) 48%, transparent);
}

.contrib__cell--l3 {
  background: color-mix(in srgb, var(--app-accent) 68%, transparent);
}

.contrib__cell--l4 {
  background: color-mix(in srgb, var(--app-accent) 92%, var(--app-ink) 4%);
}

.contrib__cell--legend {
  width: 0.55rem;
  height: 0.55rem;
  flex-shrink: 0;
}

.contrib__legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.2rem;
}

.contrib__legend-label {
  font-size: var(--app-text-2xs);
  color: var(--app-muted);
  margin-inline: 0.2rem;
}
</style>
