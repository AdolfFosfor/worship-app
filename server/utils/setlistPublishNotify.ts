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

async function resolveUserLanguageCodes(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  const unique = [...new Set(userIds.filter(Boolean))]
  await Promise.all(
    unique.map(async (userId) => {
      try {
        const { data, error } = await supabase.auth.admin.getUserById(userId)
        if (error || !data.user) {
          out.set(userId, null)
          return
        }
        const code = data.user.user_metadata?.language_code
        out.set(userId, typeof code === 'string' && code.trim() ? code.trim() : null)
      } catch {
        out.set(userId, null)
      }
    }),
  )
  return out
}

/** Best-effort Telegram DMs for a published (or preview) setlist. */
export async function notifySetlistPublished(params: {
  event: H3Event
  supabase: SupabaseClient
  setlist: SetlistNotifyRow
  botToken: string
  /** Fallback, если у получателя нет language_code в metadata. */
  fallbackLanguageCode?: string | null
  logPrefix?: string
}): Promise<{ notified: number; failed: number }> {
  const {
    event,
    supabase,
    setlist,
    botToken,
    fallbackLanguageCode = null,
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

    type Recipient = { chatId: number; userId: string }
    let accountRows: Recipient[] = []
    if (userIds.length) {
      const { data: accounts, error: accountsError } = await supabase
        .from('telegram_accounts')
        .select('telegram_id, user_id')
        .in('user_id', userIds)
      if (accountsError) {
        console.error(logPrefix, 'telegram_accounts', accountsError.message)
      } else {
        accountRows = (accounts ?? [])
          .map((a) => ({
            chatId: Number(a.telegram_id),
            userId: String(a.user_id),
          }))
          .filter((a) => Number.isFinite(a.chatId) && a.chatId > 0 && a.userId)
      }
    }

    const config = useRuntimeConfig()
    const allowlist = parseTelegramNotifyAllowlist(
      (config.telegramNotifyAllowlist as string | number | undefined) ??
        process.env.NUXT_TELEGRAM_NOTIFY_ALLOWLIST ??
        '',
    )
    const allowedChatIds = new Set(
      filterTelegramNotifyRecipients(
        accountRows.map((a) => a.chatId),
        allowlist,
      ),
    )
    const recipients = accountRows.filter((a) => allowedChatIds.has(a.chatId))
    const songs = toBotSongRows(setlist.setlist_items ?? [])

    const webAppUrl = resolveTelegramMiniAppUrl(
      (config.telegramMiniAppUrl as string) || process.env.NUXT_TELEGRAM_MINI_APP_URL || '',
      getRequestURL(event).origin,
    )
    const setlistUrl = `${webAppUrl}/setlists/${setlist.id}`

    const languageByUser = await resolveUserLanguageCodes(
      supabase,
      recipients.map((r) => r.userId),
    )

    for (const { chatId, userId } of recipients) {
      const languageCode = languageByUser.get(userId) ?? fallbackLanguageCode
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
