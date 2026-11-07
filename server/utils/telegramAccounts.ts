import type { SupabaseClient, User } from '@supabase/supabase-js'
import { telegramEmail } from './telegramAuth'

type ServiceClient = SupabaseClient

export async function findUserIdByTelegramId(
  supabase: ServiceClient,
  telegramId: number,
): Promise<string | null> {
  const { data } = await supabase
    .from('telegram_accounts')
    .select('user_id')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  return (data?.user_id as string | undefined) ?? null
}

export async function upsertTelegramAccount(
  supabase: ServiceClient,
  telegramId: number,
  userId: string,
) {
  const { error } = await supabase.from('telegram_accounts').upsert(
    { telegram_id: telegramId, user_id: userId },
    { onConflict: 'telegram_id' },
  )
  if (error) throw error
}

/** Move workspace ownership/membership from secondary → canonical, then delete secondary. */
export async function mergeAuthUserInto(
  supabase: ServiceClient,
  secondaryUserId: string,
  canonicalUserId: string,
) {
  if (secondaryUserId === canonicalUserId) return

  const { data: members } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', secondaryUserId)

  for (const row of members ?? []) {
    const { data: existing } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', row.workspace_id)
      .eq('user_id', canonicalUserId)
      .maybeSingle()

    if (existing) {
      await supabase.from('workspace_members').delete().eq('id', row.id)
      continue
    }

    const { error } = await supabase
      .from('workspace_members')
      .update({ user_id: canonicalUserId })
      .eq('id', row.id)
    if (error) throw error
  }

  for (const table of ['workspaces', 'songs', 'setlists'] as const) {
    const { error } = await supabase
      .from(table)
      .update({ created_by: canonicalUserId })
      .eq('created_by', secondaryUserId)
    if (error) throw error
  }

  await supabase.from('telegram_accounts').delete().eq('user_id', secondaryUserId)
  await supabase.auth.admin.deleteUser(secondaryUserId)
}

export function isSyntheticTelegramEmail(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith('@telegram.local'))
}

export async function findUserByEmail(
  supabase: ServiceClient,
  email: string,
): Promise<User | null> {
  const normalized = email.trim().toLowerCase()
  // getUserByEmail is not always available — use list filter via generateLink probe / admin
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return data.users.find((u) => u.email?.toLowerCase() === normalized) ?? null
}

export async function findOrCreateTelegramUser(
  supabase: ServiceClient,
  params: {
    telegramId: number
    password: string
    metadata: Record<string, unknown>
  },
): Promise<User> {
  const mappedId = await findUserIdByTelegramId(supabase, params.telegramId)
  if (mappedId) {
    const { data, error } = await supabase.auth.admin.getUserById(mappedId)
    if (error || !data.user) {
      throw createError({ statusCode: 500, statusMessage: 'Linked Telegram user missing' })
    }
    await supabase.auth.admin.updateUserById(mappedId, {
      password: params.password,
      user_metadata: {
        ...data.user.user_metadata,
        ...params.metadata,
      },
    })
    return data.user
  }

  const email = telegramEmail(params.telegramId)
  const created = await supabase.auth.admin.createUser({
    email,
    password: params.password,
    email_confirm: true,
    user_metadata: params.metadata,
  })

  if (created.error || !created.data.user) {
    const existing = await findUserByEmail(supabase, email)
    if (!existing) {
      throw createError({
        statusCode: 500,
        statusMessage: created.error?.message ?? 'Failed to create Telegram user',
      })
    }
    await supabase.auth.admin.updateUserById(existing.id, {
      password: params.password,
      user_metadata: {
        ...existing.user_metadata,
        ...params.metadata,
      },
    })
    await upsertTelegramAccount(supabase, params.telegramId, existing.id)
    return existing
  }

  await upsertTelegramAccount(supabase, params.telegramId, created.data.user.id)
  return created.data.user
}
