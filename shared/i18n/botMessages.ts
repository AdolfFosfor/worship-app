import type { AppLocale } from './locales'
import { normalizeAppLocale } from './locales'
import { localizeSessionTitle } from './messages'
import {
  bold,
  code,
  emptyList,
  escapeHtml,
  italic,
  lines,
  sep,
  title,
} from '../telegram/components'

/** Короткие строки бота (Menu Button ≤16 символов / inline buttons). */
const BOT_MESSAGES = {
  open: {
    ru: 'Открыть',
    ro: 'Deschide',
    en: 'Open',
  },
  startTitle: {
    ru: 'Worship',
    ro: 'Worship',
    en: 'Worship',
  },
  start: {
    ru: 'Откройте приложение, чтобы работать с песнями и сет-листами команды.',
    ro: 'Deschideți aplicația pentru a lucra cu cântările și setlist-urile echipei.',
    en: "Open the app to manage your team's songs and setlists.",
  },
  setlistPublishedTitle: {
    ru: 'Новый сет-лист',
    ro: 'Setlist nou',
    en: 'New setlist',
  },
  setlistPublishedEmptySongs: {
    ru: 'Песни пока не добавлены',
    ro: 'Încă nu sunt cântece',
    en: 'No songs yet',
  },
  setlistPublishedCreatedBy: {
    ru: 'Создал',
    ro: 'Creat de',
    en: 'Created by',
  },
  setlistPublishedSongsOne: {
    ru: '{count} песня',
    ro: '{count} cântec',
    en: '{count} song',
  },
  setlistPublishedSongsFew: {
    ru: '{count} песни',
    ro: '{count} cântece',
    en: '{count} songs',
  },
  setlistPublishedSongsMany: {
    ru: '{count} песен',
    ro: '{count} cântece',
    en: '{count} songs',
  },
} as const satisfies Record<string, Record<AppLocale, string>>

export type BotMessageKey = keyof typeof BOT_MESSAGES

export type BotSongRow = {
  title: string
  key?: string | null
  bpm?: number | null
  timeSignature?: string | null
}

/** Пустой / неизвестный language_code Telegram → en (не язык устройства). */
export function resolveBotLocale(languageCode: string | null | undefined): AppLocale {
  return normalizeAppLocale(languageCode) ?? 'en'
}

export function botMessage(key: BotMessageKey, languageCode: string | null | undefined): string {
  const locale = resolveBotLocale(languageCode)
  return BOT_MESSAGES[key][locale]
}

function botMessageVars(
  key: BotMessageKey,
  languageCode: string | null | undefined,
  vars: Record<string, string | number>,
): string {
  return botMessage(key, languageCode).replace(
    /\{(\w+)\}/g,
    (_, name: string) => String(vars[name] ?? `{${name}}`),
  )
}

function formatBotServiceDate(iso: string, languageCode: string | null | undefined): string {
  const locale = resolveBotLocale(languageCode)
  const tag = locale === 'ru' ? 'ru-RU' : locale === 'ro' ? 'ro-RO' : 'en-GB'
  try {
    const label = new Intl.DateTimeFormat(tag, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(`${iso}T12:00:00`))
    return label.toLocaleLowerCase(tag)
  } catch {
    return iso
  }
}

/** Plural song count — same buckets as UI (one / few / many). */
export function formatBotSongsCount(
  count: number,
  languageCode: string | null | undefined,
): string {
  const locale = resolveBotLocale(languageCode)
  const n = Math.max(0, Math.trunc(count))
  const mod10 = n % 10
  const mod100 = n % 100
  let key: BotMessageKey = 'setlistPublishedSongsMany'
  if (locale === 'en' || locale === 'ro') {
    key = n === 1 ? 'setlistPublishedSongsOne' : 'setlistPublishedSongsMany'
  } else if (mod10 === 1 && mod100 !== 11) {
    key = 'setlistPublishedSongsOne'
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    key = 'setlistPublishedSongsFew'
  }
  return botMessageVars(key, languageCode, { count: n })
}

/** Same shape as setlist-item__meta in the app. */
export function formatBotSongMeta(parts: {
  key?: string | null
  bpm?: number | null
  timeSignature?: string | null
}): string {
  const out: string[] = []
  const key = parts.key?.trim()
  if (key) out.push(key)
  if (parts.bpm != null && Number.isFinite(parts.bpm) && parts.bpm > 0) {
    out.push(String(Math.round(parts.bpm)))
  }
  const meter = parts.timeSignature?.trim()
  if (meter) out.push(meter)
  return out.join(' · ')
}

/** /start — title + short body; Open is reply_markup only. */
export function formatStartHtml(languageCode: string | null | undefined): string {
  return lines(
    title(botMessage('startTitle', languageCode)),
    sep(),
    escapeHtml(botMessage('start', languageCode)),
  )
}

type SetlistPublishedParams = {
  languageCode: string | null | undefined
  title: string
  serviceDate: string
  songs: BotSongRow[]
  authorName?: string | null
}

function songMetaLine(song: BotSongRow): string {
  return formatBotSongMeta({
    key: song.key,
    bpm: song.bpm,
    timeSignature: song.timeSignature,
  })
}

/**
 * Setlist published — Rich Message HTML (`sendRichMessage`).
 * Compact composition (restored):
 * type → title → date · count → hr → numbered table (title | params) → author.
 * Only tweak vs original: «Новый сет-лист» is bold (more visible), not italic.
 */
export function formatSetlistPublishedRichHtml(params: SetlistPublishedParams): string {
  const { languageCode, title: rawTitle, serviceDate, songs, authorName } = params
  const locale = resolveBotLocale(languageCode)
  const displayTitle = localizeSessionTitle(rawTitle, locale)
  const dateLabel = formatBotServiceDate(serviceDate, languageCode)
  const songsMeta = formatBotSongsCount(songs.length, languageCode)
  const author = authorName?.trim()

  const parts: string[] = [
    `<p><b>${escapeHtml(botMessage('setlistPublishedTitle', languageCode))}</b></p>`,
    `<p><b>${escapeHtml(displayTitle)}</b></p>`,
    `<p>${escapeHtml(dateLabel)} · ${escapeHtml(songsMeta)}</p>`,
    '<hr/>',
  ]

  if (!songs.length) {
    parts.push(
      `<p><i>${escapeHtml(botMessage('setlistPublishedEmptySongs', languageCode))}</i></p>`,
    )
  } else {
    const rows = songs
      .map((song, index) => {
        const meta = songMetaLine(song)
        const left = `${index + 1}\u2002<b>${escapeHtml(song.title)}</b>`
        const right = meta ? `<code>${escapeHtml(meta)}</code>` : ''
        return (
          `<tr>`
          + `<td align="left" valign="middle">${left}</td>`
          + `<td align="right" valign="middle">${right}</td>`
          + `</tr>`
        )
      })
      .join('')
    parts.push(`<table compact>${rows}</table>`)
  }

  if (author) {
    parts.push(
      `<footer>${escapeHtml(botMessage('setlistPublishedCreatedBy', languageCode))} · <b>${escapeHtml(author)}</b></footer>`,
    )
  }

  return parts.join('')
}

/** Classic `sendMessage` HTML fallback if sendRichMessage is unavailable. */
export function formatSetlistPublishedHtml(params: SetlistPublishedParams): string {
  const { languageCode, title: rawTitle, serviceDate, songs, authorName } = params
  const locale = resolveBotLocale(languageCode)
  const displayTitle = localizeSessionTitle(rawTitle, locale)
  const dateLabel = formatBotServiceDate(serviceDate, languageCode)
  const songsMeta = formatBotSongsCount(songs.length, languageCode)
  const author = authorName?.trim()

  const listBlock = songs.length
    ? songs
        .map((song, index) => {
          const meta = songMetaLine(song)
          const head = `${index + 1}\u2002${bold(song.title)}`
          return meta ? `${head} — ${code(meta)}` : head
        })
        .join('\n')
    : emptyList(botMessage('setlistPublishedEmptySongs', languageCode))

  const footer = author
    ? `${italic(botMessage('setlistPublishedCreatedBy', languageCode))} · ${bold(author)}`
    : ''

  return lines(
    bold(botMessage('setlistPublishedTitle', languageCode)),
    title(displayTitle),
    `${escapeHtml(dateLabel)} · ${escapeHtml(songsMeta)}`,
    sep(),
    listBlock,
    footer ? sep() : false,
    footer || false,
  )
}
