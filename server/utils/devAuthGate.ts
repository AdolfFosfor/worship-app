/**
 * Dev-mock / passwordless session — только локальная разработка.
 * Даже если NUXT_PUBLIC_ALLOW_TELEGRAM_DEV_MOCK=true на Cloudflare —
 * в production сборке пути закрыты.
 */
export function isDevAuthAllowed(config: { public: { allowTelegramDevMock?: boolean } }): boolean {
  if (!config.public.allowTelegramDevMock) return false
  if (process.env.NODE_ENV === 'production') return false
  return true
}
