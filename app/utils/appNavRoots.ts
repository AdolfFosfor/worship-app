/**
 * Корневые экраны нижнего меню / публичные — Telegram Close, без Back и edge-swipe.
 */
const ROOT_PATHS = new Set([
  '/',
  '/songs',
  '/setlists',
  '/account',
  '/login',
  '/onboarding',
])

export function isAppNavRootPath(path: string): boolean {
  if (ROOT_PATHS.has(path)) return true
  if (path.startsWith('/auth')) return true
  return false
}
