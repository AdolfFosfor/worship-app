/** Supabase Auth when JWT session_id row was deleted (stale localStorage / revoked refresh). */
export function isStaleAuthSessionMessage(message: string | null | undefined): boolean {
  const msg = (message || '').trim()
  if (!msg) return false
  return (
    /session_id claim in JWT does not exist/i.test(msg)
    || /session from session_id/i.test(msg)
    || /invalid (refresh|jwt|session)/i.test(msg)
    || /user from sub claim in jwt does not exist/i.test(msg)
  )
}
