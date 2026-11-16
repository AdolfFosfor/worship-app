interface TelegramApiResponse<T = unknown> {
  ok: boolean
  description?: string
  result?: T
}

export class TelegramBotApiError extends Error {
  constructor(
    message: string,
    readonly method: string,
  ) {
    super(message)
    this.name = 'TelegramBotApiError'
  }
}

export async function callTelegramBotApi<T = unknown>(
  botToken: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  if (!botToken || botToken === 'dev-token') {
    throw new TelegramBotApiError('Bot token is not configured', method)
  }

  const res = await $fetch<TelegramApiResponse<T>>(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    body,
  })

  if (!res.ok) {
    throw new TelegramBotApiError(res.description || `Telegram API ${method} failed`, method)
  }

  return res.result as T
}

function webAppKeyboard(buttonText: string, webAppUrl: string) {
  return {
    inline_keyboard: [
      [
        {
          text: buttonText,
          web_app: { url: webAppUrl },
        },
      ],
    ],
  }
}

/** sendMessage with official HTML parse_mode + optional web_app button. */
export async function sendHtmlMessage(params: {
  botToken: string
  chatId: number
  html: string
  buttonText?: string
  webAppUrl?: string
  effectId?: string
  disableWebPagePreview?: boolean
}) {
  const {
    botToken,
    chatId,
    html,
    buttonText,
    webAppUrl,
    effectId,
    disableWebPagePreview = true,
  } = params

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: html,
    parse_mode: 'HTML',
    disable_web_page_preview: disableWebPagePreview,
  }
  if (effectId) body.message_effect_id = effectId
  if (buttonText && webAppUrl) {
    body.reply_markup = webAppKeyboard(buttonText, webAppUrl)
  }

  return callTelegramBotApi(botToken, 'sendMessage', body)
}

export async function sendWebAppOpenMessage(params: {
  botToken: string
  chatId: number
  text: string
  buttonText: string
  webAppUrl: string
}) {
  const { botToken, chatId, text, buttonText, webAppUrl } = params
  return sendHtmlMessage({
    botToken,
    chatId,
    html: text,
    buttonText,
    webAppUrl,
  })
}

/** Celebration fullscreen effect (Bot API message_effect_id, private chats). */
export const TELEGRAM_EFFECT_CELEBRATION = '5046509860389126442'

export async function sendSetlistPublishedMessage(params: {
  botToken: string
  chatId: number
  /** Rich Message HTML (tables / footer) for sendRichMessage. */
  richHtml: string
  /** Classic parse_mode HTML fallback. */
  fallbackHtml: string
  buttonText: string
  webAppUrl: string
  effectId?: string
}) {
  const {
    botToken,
    chatId,
    richHtml,
    fallbackHtml,
    buttonText,
    webAppUrl,
    effectId = TELEGRAM_EFFECT_CELEBRATION,
  } = params

  const reply_markup = webAppKeyboard(buttonText, webAppUrl)

  try {
    return await callTelegramBotApi(botToken, 'sendRichMessage', {
      chat_id: chatId,
      rich_message: {
        html: richHtml,
        skip_entity_detection: true,
      },
      message_effect_id: effectId,
      reply_markup,
    })
  } catch (err) {
    if (!(err instanceof TelegramBotApiError)) throw err
    console.warn('[telegram] sendRichMessage fallback → sendMessage:', err.message)
    return sendHtmlMessage({
      botToken,
      chatId,
      html: fallbackHtml,
      buttonText,
      webAppUrl,
      effectId,
    })
  }
}

export async function setChatMenuButtonWebApp(params: {
  botToken: string
  chatId: number
  buttonText: string
  webAppUrl: string
}) {
  const { botToken, chatId, buttonText, webAppUrl } = params
  return callTelegramBotApi(botToken, 'setChatMenuButton', {
    chat_id: chatId,
    menu_button: {
      type: 'web_app',
      text: buttonText,
      web_app: { url: webAppUrl },
    },
  })
}
