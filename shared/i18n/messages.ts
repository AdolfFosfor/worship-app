import type { AppLocale } from './locales'

type MessageDict = Record<string, string>

export const messages: Record<AppLocale, MessageDict> = {
  ru: {
    'nav.home': 'Главная',
    'nav.songs': 'Песни',
    'nav.setlists': 'Сеты',
    'nav.settings': 'Настройки',

    'account.title': 'Аккаунт',
    'account.team': 'Команда',
    'account.settings': 'Настройки',
    'account.settingsSubtitle': 'Привязка email и Telegram',

    'settings.title': 'Настройки',
    'settings.lead':
      'Привяжите email и Telegram к одному аккаунту — тогда браузер (Magic Link) и Mini App открывают одни и те же песни и сет-листы.',
    'settings.language': 'Язык',
    'settings.languageHint': 'Интерфейс приложения на выбранном языке',
    'settings.displayName': 'Отображаемое имя',
    'settings.displayNameLabel': 'Как вас видят в команде',
    'settings.displayNameHint': 'Это имя видят в команде и на главной',
    'settings.displayNameHintTelegram': 'Сейчас из Telegram: {name}',
    'settings.displayNameSave': 'Сохранить имя',
    'settings.displayNameSaved': 'Имя сохранено',
    'settings.email': 'Email',
    'settings.emailPending': 'Ожидает подтверждения: {email}',
    'settings.emailPendingHint': 'Проверьте почту и откройте ссылку на этом устройстве.',
    'settings.emailLinked': 'Привязан: {email}',
    'settings.emailLabel': 'Рабочий email',
    'settings.emailBind': 'Привязать email',
    'settings.emailHint':
      'Письмо для привязки не отправляется (лимит Supabase Free). Адрес сразу становится вашим логином: дальше в браузере — Magic Link на этот email.',
    'settings.emailBound': 'Email привязан',
    'settings.emailBoundDetail': 'Можно входить из браузера этим адресом (Magic Link)',
    'settings.telegram': 'Telegram',
    'settings.telegramLinked': 'Привязан:',
    'settings.telegramOpenHint':
      'Чтобы привязать Telegram, откройте это приложение внутри Telegram и нажмите кнопку ниже.',
    'settings.telegramBind': 'Привязать Telegram',
    'settings.telegramBothHint':
      'Если вы уже работали в Mini App под другим входом — сначала войдите там и привяжите email, либо привяжите Telegram здесь после входа по почте.',
    'settings.telegramNeedClient':
      'Откройте приложение внутри Telegram, чтобы привязать аккаунт',
    'settings.telegramBoundDetail':
      'Аккаунт привязан — вход из Mini App и по email ведут в одни данные',
  },
  ro: {
    'nav.home': 'Acasă',
    'nav.songs': 'Cântece',
    'nav.setlists': 'Seturi',
    'nav.settings': 'Setări',

    'account.title': 'Cont',
    'account.team': 'Echipă',
    'account.settings': 'Setări',
    'account.settingsSubtitle': 'Email și Telegram',

    'settings.title': 'Setări',
    'settings.lead':
      'Conectați emailul și Telegram la același cont — astfel browserul (Magic Link) și Mini App deschid aceleași cântece și setlist-uri.',
    'settings.language': 'Limbă',
    'settings.languageHint': 'Interfața aplicației în limba aleasă',
    'settings.displayName': 'Nume afișat',
    'settings.displayNameLabel': 'Cum vă văd în echipă',
    'settings.displayNameHint': 'Acest nume este vizibil în echipă și pe ecranul principal',
    'settings.displayNameHintTelegram': 'Acum din Telegram: {name}',
    'settings.displayNameSave': 'Salvează numele',
    'settings.displayNameSaved': 'Nume salvat',
    'settings.email': 'Email',
    'settings.emailPending': 'Așteaptă confirmare: {email}',
    'settings.emailPendingHint': 'Verificați emailul și deschideți linkul pe acest dispozitiv.',
    'settings.emailLinked': 'Conectat: {email}',
    'settings.emailLabel': 'Email de lucru',
    'settings.emailBind': 'Conectează email',
    'settings.emailHint':
      'Emailul de confirmare nu se trimite (limita Supabase Free). Adresa devine imediat loginul dvs.: în browser — Magic Link pe acest email.',
    'settings.emailBound': 'Email conectat',
    'settings.emailBoundDetail': 'Puteți intra din browser cu această adresă (Magic Link)',
    'settings.telegram': 'Telegram',
    'settings.telegramLinked': 'Conectat:',
    'settings.telegramOpenHint':
      'Pentru a conecta Telegram, deschideți aplicația în Telegram și apăsați butonul de mai jos.',
    'settings.telegramBind': 'Conectează Telegram',
    'settings.telegramBothHint':
      'Dacă ați folosit Mini App cu alt login — intrați acolo și conectați emailul, sau conectați Telegram aici după autentificarea pe email.',
    'settings.telegramNeedClient':
      'Deschideți aplicația în Telegram pentru a conecta contul',
    'settings.telegramBoundDetail':
      'Cont conectat — Mini App și email duc la aceleași date',
  },
  en: {
    'nav.home': 'Home',
    'nav.songs': 'Songs',
    'nav.setlists': 'Sets',
    'nav.settings': 'Settings',

    'account.title': 'Account',
    'account.team': 'Team',
    'account.settings': 'Settings',
    'account.settingsSubtitle': 'Email and Telegram linking',

    'settings.title': 'Settings',
    'settings.lead':
      'Link email and Telegram to one account — then the browser (Magic Link) and Mini App open the same songs and setlists.',
    'settings.language': 'Language',
    'settings.languageHint': 'App interface in the selected language',
    'settings.displayName': 'Display name',
    'settings.displayNameLabel': 'How the team sees you',
    'settings.displayNameHint': 'This name appears in the team and on the home screen',
    'settings.displayNameHintTelegram': 'Currently from Telegram: {name}',
    'settings.displayNameSave': 'Save name',
    'settings.displayNameSaved': 'Name saved',
    'settings.email': 'Email',
    'settings.emailPending': 'Pending confirmation: {email}',
    'settings.emailPendingHint': 'Check your inbox and open the link on this device.',
    'settings.emailLinked': 'Linked: {email}',
    'settings.emailLabel': 'Work email',
    'settings.emailBind': 'Link email',
    'settings.emailHint':
      'Confirmation email is not sent (Supabase Free limit). The address becomes your login immediately: in the browser use Magic Link to this email.',
    'settings.emailBound': 'Email linked',
    'settings.emailBoundDetail': 'You can sign in from the browser with this address (Magic Link)',
    'settings.telegram': 'Telegram',
    'settings.telegramLinked': 'Linked:',
    'settings.telegramOpenHint':
      'To link Telegram, open this app inside Telegram and tap the button below.',
    'settings.telegramBind': 'Link Telegram',
    'settings.telegramBothHint':
      'If you already used the Mini App under another login — sign in there and link email first, or link Telegram here after email sign-in.',
    'settings.telegramNeedClient': 'Open the app inside Telegram to link your account',
    'settings.telegramBoundDetail':
      'Account linked — Mini App and email sign-in share the same data',
  },
}

export function translate(
  locale: AppLocale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const template = messages[locale][key] ?? messages.en[key] ?? messages.ru[key] ?? key
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`))
}
