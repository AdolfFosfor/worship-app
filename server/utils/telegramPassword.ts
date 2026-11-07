/** Deterministic password fragment so TG login works without storing a secret. */
export function telegramPassword(telegramId: number, botToken: string): string {
  const seed = botToken || 'dev-token'
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return `tg_${telegramId}_${hash.toString(16)}`
}
