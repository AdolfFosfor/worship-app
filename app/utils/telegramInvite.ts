/**
 * Deep link into the bot Main Mini App with invite code as start_param.
 * Opens inside Telegram — not an external browser.
 */
export function buildTelegramInviteLink(botUsername: string, inviteCode: string): string {
  const bot = botUsername.replace(/^@/, '').trim()
  const code = inviteCode.trim().toUpperCase()
  if (!bot || !code) return ''
  return `https://t.me/${bot}?startapp=${code}`
}

export function buildTelegramShareUrl(inviteLink: string, text: string): string {
  const params = new URLSearchParams({
    url: inviteLink,
    text,
  })
  return `https://t.me/share/url?${params.toString()}`
}
