import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  botMessage,
  formatSetlistPublishedHtml,
  formatSetlistPublishedRichHtml,
  type BotSongRow,
} from '../../shared/i18n/botMessages'
import {
  sendSetlistPublishedMessage,
  TelegramBotApiError,
} from './telegramBotApi'
import { resolveTelegramMiniAppUrl } from './telegramMenuButton'
import {
  filterTelegramNotifyRecipients,
  parseTelegramNotifyAllowlist,
} from './telegramNotifyAllowlist'

export type SetlistNotifySong = {
  title: string
  key: string
  capo: number
  bpm: number | null
  time_signature: string | null
  sounding_key: string | null
}

export type SetlistNotifyRow = {
  id: string
  workspace_id: string
  title: string
  service_date: string
  created_by: string | null
  setlist_items?: Array<{
    position: number
    key: string | null
    songs: SetlistNotifySong | null
  }> | null
}

function toBotSongRows(
  items: NonNullable<SetlistNotifyRow['setlist_items']>,
): BotSongRow[] {
  const sorted = [...items].sort((a, b) => a.position - b.position)
  const rows: BotSongRow[] = []
  for (const item of sorted) {
    const song = item.songs
    const title = song?.title?.trim()
    if (!title) continue
    const key =
      item.key?.trim()
      || song.sounding_key?.trim()
      || song.key?.trim()
      || null
    rows.push({
      title,
      key,
      bpm: song.bpm,
      timeSignature: song.time_signature,
    })
  }
  return rows
}

/** Best-effort Telegram DMs for a published (or preview) setlist. */
export async function notifySetlistPublished(params: {
  event: H3Event
  supabase: SupabaseClient
  setlist: SetlistNotifyRow
  languageCode: string | null | undefined
  botToken: string
  logPrefix?: string
}): Promise<{ notified: number; failed: number }> {
  const {
    event,
    supabase,
    setlist,
    languageCode,
    botToken,
    logPrefix = '[setlists/notify]',
  } = params

  let notified = 0
  let failed = 0

  if (!botToken || botToken === 'dev-token') {
    return { notified, failed }
  }

  try {
    const { data: members, error: membersError } = await supabase
      .from('workspace_members')
      .select('user_id, display_name')
      .eq('workspace_id', setlist.workspace_id)

    if (membersError) {
      console.error(logPrefix, 'members', membersError.message)
      return { notified, failed }
    }

    const memberRows = members ?? []
    const userIds = memberRows.map((m) => m.user_id as string).filter(Boolean)
    const authorName =
      (setlist.created_by
        ? memberRows.find((m) => m.user_id === setlist.created_by)?.display_name
        : null)?.trim() || null

    let telegramIds: number[] = []
    if (userIds.length) {
      const { data: accounts, error: accountsError } = await supabase
        .from('telegram_accounts')
        .select('telegram_id, user_id')
        .in('user_id', userIds)
      if (accountsError) {
        console.error(logPrefix, 'telegram_accounts', accountsError.message)
      } else {
        telegramIds = (accounts ?? [])
          .map((a) => Number(a.telegram_id))
          .filter((id) => Number.isFinite(id) && id > 0)
      }
    }

    const config = useRuntimeConfig()
    const allowlist = parseTelegramNotifyAllowlist(
      (config.telegramNotifyAllowlist as string | number | undefined) ??
        process.env.NUXT_TELEGRAM_NOTIFY_ALLOWLIST ??
        '',
    )
    const recipients = filterTelegramNotifyRecipients(telegramIds, allowlist)
    const songs = toBotSongRows(setlist.setlist_items ?? [])

    const webAppUrl = resolveTelegramMiniAppUrl(
      (config.telegramMiniAppUrl as string) || process.env.NUXT_TELEGRAM_MINI_APP_URL || '',
      getRequestURL(event).origin,
    )
    const setlistUrl = `${webAppUrl}/setlists/${setlist.id}`
    const buttonText = botMessage('open', languageCode)
    const richHtml = formatSetlistPublishedRichHtml({
      languageCode,
      title: setlist.title,
      serviceDate: setlist.service_date,
      songs,
      authorName,
    })
    const fallbackHtml = formatSetlistPublishedHtml({
      languageCode,
      title: setlist.title,
      serviceDate: setlist.service_date,
      songs,
      authorName,
    })

    for (const chatId of recipients) {
      try {
        await sendSetlistPublishedMessage({
          botToken,
          chatId,
          richHtml,
          fallbackHtml,
          buttonText,
          webAppUrl: setlistUrl,
        })
        notified += 1
      } catch (err) {
        failed += 1
        const reason =
          err instanceof TelegramBotApiError ? err.message : 'send failed'
        console.error(logPrefix, 'notify', chatId, reason)
      }
    }
  } catch (err) {
    console.error(logPrefix, 'batch', err instanceof Error ? err.message : err)
  }

  return { notified, failed }
}
