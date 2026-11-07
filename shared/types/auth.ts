/**
 * Auth identity used across Web (magic link) and Telegram Mini App.
 */
export interface AuthUser {
  id: string
  email?: string | null
  /** Pending email change (confirmation not finished). */
  pendingEmail?: string | null
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  telegramId?: number | null
  languageCode?: string | null
  /** True when email is a real inbox (not tg_*@telegram.local). */
  hasRealEmail?: boolean
}

export interface AuthSession {
  user: AuthUser
  accessToken: string
  refreshToken?: string
  /** Present when authenticated via Telegram initData (or mock). */
  initDataRaw?: string
}
