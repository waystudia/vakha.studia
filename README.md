# Vakha Studio — заявки родителей

Отдельный модуль Photo CRM для сбора школьных фотозаказов. Администратор создаёт школу, класс и список детей, передаёт родителям публичную ссылку/QR, а затем обрабатывает заявки и экспортирует их в CSV.

## Возможности MVP

- вход и регистрация администратора через Supabase Auth;
- школы, классы и дети с архивированием и защитой от дублей;
- импорт детей из CSV/XLS/XLSX;
- импорт `catalog_export.zip` из публичного экспорта CRM Photo;
- загрузка превью каталога в Supabase Storage;
- непредсказуемая публичная ссылка класса и QR-код;
- мобильный выбор ребёнка и нескольких услуг;
- серверный расчёт суммы и защита от двойной заявки;
- статусы заявок и CSV-экспорт.

## Запуск

Скопируйте `.env.example` в `.env.local` и заполните данные Supabase.

```bash
npm install
npm run dev
```

Откройте <http://127.0.0.1:5173/login>.

Production: <https://waystudia.github.io/vakha.studia/>

## Проверка

```bash
npm test
npm run build
npm run check
supabase db query --linked --file supabase/tests/mvp_integration.sql
```

Миграция Supabase находится в `supabase/migrations/`.

## Формат ZIP-каталога

Поддержан фактический экспорт CRM Photo: `catalog.json`, `assets/images/*` и `assets/videos/*`. Повторный импорт обновляет услуги по исходному ID без создания дублей.

### CRM deployment (zakaz.khanzama.ru)

`VITE_CRM_MODE=true npm run build` retains the existing parent-order design and
uses the same-origin CRM public API, without loading the Supabase app. Deploy
`dist/` to `/srv/vakha-studia/releases/<release>` and atomically set `current`.
Caddy serves SPA routes and proxies only `/api/v1/public/*` to the CRM API.
Schools, children, services and previews are managed in CRM; no second catalog
is imported into this deployment. The default build and legacy Supabase remain
unchanged. The root page asks parents to use a class link; it lists no children.
Old source: `/Users/abdulkadyrov2002/Documents/vakha-studia-preserved-20261101/source-before-crm.tar`.
