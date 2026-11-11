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

export async function sendWebAppOpenMessage(params: {
  botToken: string
  chatId: number
  text: string
  buttonText: string
  webAppUrl: string
}) {
  const { botToken, chatId, text, buttonText, webAppUrl } = params
  return callTelegramBotApi(botToken, 'sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: buttonText,
            web_app: { url: webAppUrl },
          },
        ],
      ],
    },
  })
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
