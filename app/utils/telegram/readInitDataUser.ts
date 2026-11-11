/**
 * Парсит user из сырого initData (query string).
 * Предпочтительнее сигнала SDK: URL/launch params обновляются при каждом открытии.
 */
export function parseTelegramUserFromInitData(raw: string | null | undefined): {
  id?: number
  language_code?: string
  first_name?: string
  last_name?: string
  username?: string
} | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  try {
    const userJson = new URLSearchParams(trimmed).get('user')
    if (!userJson) return null
    const user = JSON.parse(userJson) as Record<string, unknown>
    if (!user || typeof user !== 'object') return null
    return {
      id: typeof user.id === 'number' ? user.id : undefined,
      language_code: typeof user.language_code === 'string' ? user.language_code : undefined,
      first_name: typeof user.first_name === 'string' ? user.first_name : undefined,
      last_name: typeof user.last_name === 'string' ? user.last_name : undefined,
      username: typeof user.username === 'string' ? user.username : undefined,
    }
  } catch {
    return null
  }
}
