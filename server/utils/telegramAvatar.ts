import type { SupabaseClient } from '@supabase/supabase-js'

type ServiceClient = SupabaseClient

interface TelegramApiResponse<T> {
  ok: boolean
  description?: string
  result?: T
}

/**
 * Mini App отдаёт photo_url только из attachment menu.
 * Для обычного запуска тянем фото через Bot API и кладём в Storage
 * (без bot token в публичном URL).
 */
export async function resolveTelegramProfileFileUrl(
  botToken: string,
  telegramId: number,
): Promise<string | null> {
  if (!botToken || botToken === 'dev-token') return null

  try {
    const photos = await $fetch<
      TelegramApiResponse<{ total_count: number; photos: { file_id: string }[][] }>
    >(`https://api.telegram.org/bot${botToken}/getUserProfilePhotos`, {
      query: { user_id: telegramId, limit: 1 },
    })
    if (!photos.ok) return null

    const sizes = photos.result?.photos?.[0]
    if (!sizes?.length) return null

    // photos[0] — размеры от малого к крупному
    const fileId = sizes[Math.min(sizes.length - 1, 2)]!.file_id
    const file = await $fetch<TelegramApiResponse<{ file_path?: string }>>(
      `https://api.telegram.org/bot${botToken}/getFile`,
      { query: { file_id: fileId } },
    )
    if (!file.ok || !file.result?.file_path) return null

    return `https://api.telegram.org/file/bot${botToken}/${file.result.file_path}`
  } catch {
    return null
  }
}

export async function syncTelegramAvatar(
  supabase: ServiceClient,
  params: {
    botToken: string
    telegramId: number
    userId: string
    initPhotoUrl?: string | null
  },
): Promise<string | null> {
  const { botToken, telegramId, userId, initPhotoUrl } = params

  let sourceUrl = initPhotoUrl?.trim() || null
  if (!sourceUrl) {
    sourceUrl = await resolveTelegramProfileFileUrl(botToken, telegramId)
  }
  if (!sourceUrl) return null

  let buffer: Buffer
  let contentType = 'image/jpeg'
  try {
    const res = await fetch(sourceUrl)
    if (!res.ok) return null
    contentType = res.headers.get('content-type') || contentType
    buffer = Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }

  if (!buffer.length) return null

  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : 'jpg'
  const path = `${userId}.${ext}`

  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, buffer, {
    contentType,
    upsert: true,
  })
  if (uploadError) {
    console.error('[avatar] upload failed', uploadError.message)
    return null
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`

  const { data: current } = await supabase.auth.admin.getUserById(userId)
  await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...(current?.user?.user_metadata ?? {}),
      photo_url: publicUrl,
    },
  })

  await supabase
    .from('workspace_members')
    .update({ avatar_url: publicUrl })
    .eq('user_id', userId)

  return publicUrl
}
