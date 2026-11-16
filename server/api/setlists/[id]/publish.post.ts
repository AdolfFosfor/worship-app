import { requireAuthUser } from '../../../utils/authUser'
import {
  notifySetlistPublished,
  type SetlistNotifyRow,
} from '../../../utils/setlistPublishNotify'

type SetlistSongJoin = SetlistNotifyRow & {
  status: string
}

export default defineEventHandler(async (event) => {
  const setlistId = getRouterParam(event, 'id')
  if (!setlistId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing setlist id' })
  }

  const { user, supabase } = await requireAuthUser(event)
  const config = useRuntimeConfig()
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

  const row = setlist as SetlistSongJoin

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
      statusMessage: 'Only leaders can publish setlists',
    })
  }

  if (row.status === 'published') {
    throw createError({ statusCode: 409, statusMessage: 'Already published' })
  }

  const nowIso = new Date().toISOString()
  const { data: published, error: publishError } = await supabase
    .from('setlists')
    .update({
      status: 'published',
      published_at: nowIso,
      published_by: user.id,
    })
    .eq('id', setlistId)
    .eq('status', 'draft')
    .select('id, status, published_at, published_by')
    .maybeSingle()

  if (publishError) {
    throw createError({
      statusCode: 500,
      statusMessage: publishError.message || 'Publish failed',
    })
  }
  if (!published) {
    throw createError({ statusCode: 409, statusMessage: 'Already published' })
  }

  const languageCode =
    (user.user_metadata?.language_code as string | undefined) ?? null

  const { notified, failed } = await notifySetlistPublished({
    event,
    supabase,
    setlist: row,
    languageCode,
    botToken,
    logPrefix: '[setlists/publish]',
  })

  return {
    published: true,
    id: setlistId,
    status: 'published' as const,
    publishedAt: published.published_at as string,
    publishedBy: published.published_by as string,
    notified,
    failed,
  }
})
