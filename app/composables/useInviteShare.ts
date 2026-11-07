import { initData, shareURL } from '@tma.js/sdk-vue'
import { buildTelegramInviteLink, buildTelegramShareUrl } from '~/utils/telegramInvite'

const PENDING_INVITE_KEY = 'worship-pending-invite'
const CONSUMED_INVITE_KEY = 'worship-consumed-invite'

/**
 * Native Telegram invite links (startapp) + one-shot start_param consumption.
 */
export function useInviteShare() {
  const config = useRuntimeConfig()
  const telegram = useTelegramApp()

  const botUsername = computed(() =>
    String(config.public.telegramBotUsername || '').replace(/^@/, '').trim(),
  )

  function inviteLinkFor(code: string): string {
    return buildTelegramInviteLink(botUsername.value, code)
  }

  function shareMessage(teamName?: string | null): string {
    const name = teamName?.trim()
    return name
      ? `Присоединяйся к «${name}» в Worship`
      : 'Присоединяйся к команде в Worship'
  }

  /** Share via Telegram native sheet (Mini App) or t.me/share fallback. */
  function shareInvite(code: string, teamName?: string | null) {
    const link = inviteLinkFor(code)
    if (!link) {
      throw new Error('Не задан username бота (NUXT_PUBLIC_TELEGRAM_BOT_USERNAME)')
    }
    const text = shareMessage(teamName)

    if (telegram.isTelegramEnvironment.value && shareURL.isAvailable()) {
      shareURL(link, text)
      return
    }

    if (!import.meta.client) return
    window.open(buildTelegramShareUrl(link, text), '_blank', 'noopener,noreferrer')
  }

  function readStartParam(): string | undefined {
    if (!import.meta.client) return undefined
    try {
      const code = initData.startParam()?.trim()
      return code || undefined
    } catch {
      return undefined
    }
  }

  /** Capture start_param once per session so invite is not reopened forever. */
  function capturePendingInviteFromStartParam() {
    if (!import.meta.client) return
    const code = readStartParam()
    if (!code) return
    try {
      if (sessionStorage.getItem(CONSUMED_INVITE_KEY) === code) return
      sessionStorage.setItem(PENDING_INVITE_KEY, code)
    } catch {
      // private mode / storage blocked
    }
  }

  function takePendingInvite(): string | undefined {
    if (!import.meta.client) return undefined
    try {
      const code = sessionStorage.getItem(PENDING_INVITE_KEY)?.trim()
      if (!code) return undefined
      sessionStorage.removeItem(PENDING_INVITE_KEY)
      sessionStorage.setItem(CONSUMED_INVITE_KEY, code)
      return code
    } catch {
      return undefined
    }
  }

  return {
    botUsername,
    inviteLinkFor,
    shareInvite,
    capturePendingInviteFromStartParam,
    takePendingInvite,
  }
}
