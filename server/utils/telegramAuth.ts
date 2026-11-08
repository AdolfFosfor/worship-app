import { createHmac, timingSafeEqual } from 'node:crypto'

export interface TelegramWebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  /** Rare: only for Mini Apps from attachment menu. */
  photo_url?: string
}

export interface ValidatedTelegramInitData {
  user: TelegramWebAppUser
  authDate: number
  raw: string
}

function buildDataCheckString(params: URLSearchParams): string {
  const pairs: string[] = []
  for (const key of [...params.keys()].sort()) {
    if (key === 'hash') continue
    pairs.push(`${key}=${params.get(key)}`)
  }
  return pairs.join('\n')
}

/**
 * Validates Telegram Mini App initData per Bot API.
 * Dev mock hash `dev_mock_hash` is accepted only when `allowDevMock` is true.
 */
export function validateTelegramInitData(
  initDataRaw: string,
  botToken: string,
  options: { allowDevMock?: boolean; maxAgeSec?: number } = {},
): ValidatedTelegramInitData {
  const { allowDevMock = false, maxAgeSec = 86400 } = options
  const params = new URLSearchParams(initDataRaw)
  const hash = params.get('hash')
  const userRaw = params.get('user')
  const authDateRaw = params.get('auth_date')

  if (!hash || !userRaw || !authDateRaw) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid Telegram init data' })
  }

  const isDevMock = allowDevMock && hash === 'dev_mock_hash'

  if (!isDevMock) {
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
    const calculated = createHmac('sha256', secretKey)
      .update(buildDataCheckString(params))
      .digest('hex')

    const a = Buffer.from(calculated, 'hex')
    const b = Buffer.from(hash, 'hex')
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw createError({ statusCode: 401, statusMessage: 'Telegram init data hash mismatch' })
    }
  }

  const authDate = Number(authDateRaw)
  if (!Number.isFinite(authDate)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid auth_date' })
  }

  if (!isDevMock && maxAgeSec > 0) {
    const age = Math.floor(Date.now() / 1000) - authDate
    if (age > maxAgeSec) {
      throw createError({ statusCode: 401, statusMessage: 'Telegram init data expired' })
    }
  }

  let user: TelegramWebAppUser
  try {
    user = JSON.parse(userRaw) as TelegramWebAppUser
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Invalid Telegram user payload' })
  }

  if (!user?.id || !user.first_name) {
    throw createError({ statusCode: 401, statusMessage: 'Incomplete Telegram user' })
  }

  return { user, authDate, raw: initDataRaw }
}

export function telegramEmail(telegramId: number): string {
  return `tg_${telegramId}@telegram.local`
}
