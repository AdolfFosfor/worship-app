/** Human-readable auth / API error for toasts. */
export function authErrorMessage(error: unknown, fallback = 'Ошибка'): string {
  if (!error) return fallback

  if (typeof error === 'string' && error.trim()) return error

  if (error instanceof Error) {
    const msg = error.message || fallback
    if (/rate.?limit/i.test(msg) || /over_email_send_rate_limit/i.test(msg)) {
      return 'Лимит писем Supabase. Подождите около часа или повторите привязку — теперь она без письма.'
    }
    return msg
  }

  if (typeof error === 'object') {
    const obj = error as {
      message?: string
      statusMessage?: string
      data?: { message?: string; statusMessage?: string; code?: string }
      code?: string
    }
    const raw =
      obj.data?.statusMessage ||
      obj.data?.message ||
      obj.statusMessage ||
      obj.message ||
      fallback
    if (obj.code === 'over_email_send_rate_limit' || /rate.?limit/i.test(raw)) {
      return 'Лимит писем Supabase. Подождите около часа или повторите привязку — теперь она без письма.'
    }
    return raw
  }

  return fallback
}
