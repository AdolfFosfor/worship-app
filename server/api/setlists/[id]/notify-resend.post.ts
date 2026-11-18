import { requireAuthUser } from '../../../utils/authUser'
import { isDevAuthAllowed } from '../../../utils/devAuthGate'
import {
  notifySetlistPublished,
  type SetlistNotifyRow,
} from '../../../utils/setlistPublishNotify'

/** Dev-only: re-send setlist published Telegram DMs without changing status. */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!isDevAuthAllowed(config)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const setlistId = getRouterParam(event, 'id')
  if (!setlistId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing setlist id' })
  }

  const { user, supabase } = await requireAuthUser(event)
  const botToken =
    (config.telegramBotToken as string) || process.env.NUXT_TELEGRAM_BOT_TOKEN || ''

  const { data: setlist, error: setlistError } = await supabase
    .from('setlists')
    .select(
      'id, workspace_id, title, service_date, status, created_by, setlist_items(position, key, songs(title, key, capo, bpm, time_signature, sounding_key))',
    )
    .eq('id', setlistId)
    .single()

  if (setlistError || !setlist) {
    throw createError({ statusCode: 404, statusMessage: 'Setlist not found' })
  }

  const row = setlist as SetlistNotifyRow & { status: string }
  const userId = user.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid session' })
  }

  const { data: membership, error: membershipError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', row.workspace_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (membershipError) {
    throw createError({
      statusCode: 500,
      statusMessage: membershipError.message || 'Membership check failed',
    })
  }

  const role = membership?.role as string | undefined
  if (role !== 'administrator' && role !== 'worship_leader') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only leaders can notify setlists',
    })
  }

  const { notified, failed } = await notifySetlistPublished({
    event,
    supabase,
    setlist: row,
    botToken,
    fallbackLanguageCode:
      (user.user_metadata?.language_code as string | undefined) ?? null,
    logPrefix: '[setlists/notify-resend]',
  })

  return {
    resent: true,
    id: setlistId,
    status: row.status,
    notified,
    failed,
  }
})
