# Worship

Приложение для группы прославления: общая библиотека песен, сет-листы служений и участники команды.

Работает как **Web App** и **Telegram Mini App** на одном Nuxt-фронтенде и одной базе Supabase.

## Стек

- Nuxt 4 SPA (`ssr: false`)
- Pinia, PrimeVue, Tailwind 4, VueUse
- `@tma.js` (Telegram Mini App)
- Supabase (Auth + Postgres + RLS)

## Быстрый старт

1. Скопируйте env:

```bash
cp .env.example .env
```

2. Создайте бесплатный проект на [supabase.com](https://supabase.com) и заполните:

- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_ANON_KEY`
- `NUXT_SUPABASE_SERVICE_ROLE_KEY` (только сервер)
- `NUXT_TELEGRAM_BOT_TOKEN` (токен бота для проверки initData)

3. Примените миграцию:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Или вставьте SQL из [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql) в SQL Editor в кабинете Supabase.

4. Включите Email Auth (Magic Link) в Supabase → Authentication → Providers.

5. Запустите фронтенд:

```bash
npm install
npm run dev
```

В браузере без Telegram поднимается mock initData (см. `NUXT_PUBLIC_ALLOW_TELEGRAM_DEV_MOCK`).

## Telegram Mini App

1. Создайте бота у [@BotFather](https://t.me/BotFather).
2. Подключите Mini App / Web App URL (публичный HTTPS, например Cloudflare Tunnel / Vercel).
3. Укажите тот же URL в настройках бота.
4. Токен бота — в `NUXT_TELEGRAM_BOT_TOKEN`.

Auth: клиент отправляет `initData` на `POST /api/auth/telegram`, сервер проверяет подпись и выдаёт сессию Supabase.

## Роли

| Роль | Песни / сет-листы | Участники |
|------|-------------------|-----------|
| Administrator | полный доступ | приглашение, роли, удаление |
| Worship Leader | полный доступ | просмотр |
| Musician | только просмотр | просмотр |

## Структура данных

Таблицы: `workspaces`, `workspace_members`, `songs`, `setlists`, `setlist_items`.

Тональность конкретной песни в сет-листе хранится в `setlist_items.key` и не меняет оригинал в `songs`.

## Скрипты

```bash
npm run dev
npm run lint:fix
npm run typecheck
npm run build
npm test
npm run icons:extract
```

## Production (Cloudflare Pages)

Nitro preset: `cloudflare_pages` (SPA + `/api/*` на Workers).

| Setting | Value |
|---------|--------|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `22` |

Env (Pages → Settings → Environment variables):

- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_ANON_KEY`
- `NUXT_SUPABASE_SERVICE_ROLE_KEY` (secret)
- `NUXT_TELEGRAM_BOT_TOKEN` (secret)
- `NUXT_PUBLIC_ALLOW_TELEGRAM_DEV_MOCK=false`

Supabase Auth → Site URL / Redirect URLs: `https://YOUR_PAGES_DOMAIN` и `https://YOUR_PAGES_DOMAIN/auth/callback` (плюс `/**` если нужно).
