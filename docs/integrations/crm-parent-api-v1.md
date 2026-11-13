# Vakha Studio: CRM public API v1

Status: frontend prepared locally on `codex/crm-parent-api-integration-20261113`.
No deployment, DNS change, real order, CRM browser data migration or main push.
Backend owner: `crm.photo`, `docs/integrations/parent-orders-v1.md`.

## Build and ownership boundaries

- Default `npm run build` remains the Supabase application with its existing admin,
  catalog, parent links, JSON class-link exchange and ZIP export/import.
- `VITE_CRM_MODE=true npm run build` is the additional parent-only application.
  It uses same-origin `/api/v1/public`, `credentials: omit`, no staff cookies and
  no Supabase calls (including analytics and attachment signing). Supabase env
  values are not required at runtime in this mode. There is no provider fallback
  that copies a parent submission to a different database after a CRM failure.
- Domains/origins remain `crm.khanzama.ru`, `zakaz.khanzama.ru`, and
  `khanzama.ru/ar.photo/`. Do not change an origin to migrate IndexedDB.
- This repository does not publish schools, grant staff roles, synchronize CRM's
  offline data, build AR/QRs or send WhatsApp. Those remain in CRM/AR.
  CRM creates and publishes the project/class/group and obtains the stable class
  capability link for its existing message composer. Teachers/parents see only
  the class attached to that link. Root shows no directory of classes.

## Wire endpoints

Paths below are relative to `/api/v1/public`; encode every path parameter.
JSON requests set Content-Type; multipart requests let the browser set boundary.
Server responses are JSON objects directly, without a `{data: ...}` wrapper.

| Method/path | Request | Response |
| --- | --- | --- |
| GET `classes/:token` | none | `PublicClassPayload` below |
| POST `classes/:token/children/preview` | `{firstName,lastName}` | `{matches:[{id,public_name}],revision?}`; read-only |
| POST `classes/:token/children` | `{firstName,lastName,requestKey}` | `{child:{id,public_name,orders?},duplicate}` |
| POST `classes/:token` | `{childId,itemIds,withoutLaminationIds,note,itemPreferences,revision,requestKey}` | `PublicOrderResult` |
| POST `classes/:token/children/:childId/custom-request` | JSON `{message,catalogItemId?,revision,requestKey}` or multipart same fields plus `reference` | `PublicOrderResult` |
| POST `classes/:token/children/:childId/service-video` | multipart `{itemId,revision,requestKey,video}` | `PublicOrderResult` |
| POST `classes/:token/children/:childId/order/cancel` | `{revision,requestKey}` | `PublicOrderResult` |
| GET `orders/:publicToken` | none | `PublicOrderResult` plus `school_name,created_at` |

`PublicClassPayload`:

```ts
{
  school: {name: string, city: string},
  class: {id: string, name: string, academic_year: string, photo_session_name: string},
  children: [{id: string, public_name: string,
    orders?: [{revision: number, status: string, items: SelectedOrderItem[]}]}],
  catalog: [{id, name, description, short_description, type, category, gender,
    price, preview_url, preview_video_url, parent_preview_mode, popular?}]
}
```

`PublicOrderResult`: `{revision,duplicate,updated?,order_number,status,
selected_items,total_amount,child_name,class_name,public_token}`.
New order revision is **0 in the request**, at least 1 in the response. Every
subsequent mutation sends the last acknowledged revision. Legacy ordinary
orders must be returned with revision 1. Class-level preview revision is not an
order revision. Mutations return the full current item list, including custom
requests and comments. The normal order update must preserve custom requests
and private media; it must not replace the entire order with only `itemIds`.

`itemPreferences`: `{[catalogItemId]: {comment:string,videoAddonRequested:boolean}}`.
The server calculates all prices from its own class catalog: current lamination
choice, current add-on rule (+500), selected quantity/availability, and rejects
unknown or inaccessible children/services. Client totals are only a preview;
confirmation always uses the returned `total_amount`.

Selected items may carry `parent_comment`, `video_addon_requested` (or
`videoAddonRequested`), `requestType:'custom'`, `price_pending`, `referenceMediaId`,
`parentVideoMediaId`, and optional display filenames/authorized preview URLs.
Without a catalog reference, custom work is `price_pending:true`; UI says
“По согласованию”, never “бесплатно”. Media IDs are identifiers, not URLs. The
frontend does not construct anonymous download URLs from them. Only render an
explicit authorized `preview_url` / `parent_video_url` supplied by the backend;
signed URLs are not modified with cache-busting parameters in CRM mode.

## Required backend guarantees / integration gates

1. Capability token must scope every read and mutation to one active class;
   child, service, order, media IDs must belong to that class. No employee names,
   phones, payment data or staff auth/session payload in class/preview responses.
   Cross-class probing and disabled/revoked/expired links must fail.
2. Exact normalized duplicate child creation returns the original ID, including
   races; similar names are suggestions and must permit an explicit new child.
   New server UUID is immediately the canonical CRM student ID.
3. Every mutation atomically records `requestKey + payload fingerprint + result`
   with the CRM write. Same key/body returns original result before revision
   checking. Same key/different body and stale revision return 409 without a write.
   Return a human-readable `error` and, where available, `code:'version_conflict'`.
4. GET class includes public order summaries and per-order revisions so existing
   selections/comments are visible and editing uses a known version. Ordinary
   POST must support revision-checked updates and persist preferences. The backend owner has added these routes locally; live integration remains
   unverified until both repositories are exercised against isolated server data.
5. Reference images: frontend JPEG/PNG/WebP up to 5 MiB; video chooser up to
   120 MiB before local compression, upload up to 25 MiB (MP4/WebM/MOV). Backend
   must independently check MIME, signatures, size, quotas and private access.
   No public original file URLs. Retry attachments with original bytes/key.
6. Server permits exact parent origin `https://zakaz.khanzama.ru`, rate limits
   public writes/preview, and returns JSON for errors (including proxy limits).
   Proxy must accept multipart overhead above 25 MiB and forward only the public
   API. Server scopes/cookies/CORS and lifecycle policies are backend work.
7. CRM applies received children/services/comments/media additively to its
   offline-first records and existing conflict review. No resetting IndexedDB,
   replacing the local store with a server snapshot, or changing print/ZIP/PWA.

## Retry, conflict and offline behavior

The additional CRM parent frontend owns **only** IndexedDB
`vakha-parent-public-requests-v1`, store `requests`. It never opens/migrates/clears
CRM's databases. A mutation is durably reserved before network transmission.
Atomic IndexedDB reservation collapses identical drafts across tabs to one key.
A fingerprint covers path, fields, preferences, revision, filename/MIME and file
bytes; a changed comment/choice/file gets a different key. No child ID is minted
client-side. Pending records include their class capability and files: keep the
origin private and do not export logs containing them.

Network loss, timeout, 429 or 5xx keep the original draft and key. Reopening the
same class after the page can load displays its queue and an explicit retry.
No automatic replay, background service worker, Background Sync, or promise of
uploading with a closed PWA. The parent page does not offer initial offline
loading of a class/catalog and does not cache a public roster as offline truth.
The separate offline CRM/PWA and its ZIP workflow remain independent.

409 pauses a record for user review; 4xx validation/revoked links retain a rejected
record. No automatic retry with a newer revision or different provider. User can
refresh class and explicitly remove the old local attempt, reopen the child,
check server selections and send a new intent. Removing from the local queue is
not cancellation of an order already accepted by the server. Pending files are
removed after acknowledged success or explicit queue removal; persistence quota
failure stops transmission before the network call.

Order and videos are separate server acknowledgements. In the current open page,
if order succeeds but upload fails, retry reuses the accepted order and resumes
remaining files rather than resubmitting the order. Successful videos are removed
from the in-memory pending file list. Compressed file bytes are cached per chosen
File to keep retry identity stable. A close/reload before compression or durable
upload reservation can lose a not-yet-queued file; do not claim transactional
all-or-nothing submission of order plus multiple files.

## Verification and remaining acceptance

- Unit/component tests use synthetic data and mock transports; no real parents,
  orders, staff sessions, paid AI, WhatsApp or production writes.
- Both default and CRM builds must pass. CRM build/runtime must not need
  Supabase; do not remove the default build's Supabase setup.
- Browser fixture on a separate localhost origin tests actual IndexedDB:
  synthetic child request -> 503 -> reload -> queue survives -> explicit retry
  -> child appears once, queue clears. This does not certify production API,
  DNS, S3 permissions, physical iPhone/PWA background behavior or media upload.
- Before deployment: run against isolated CRM backend data, test class ACL,
  stale versions, lost responses, modified comments, multipart retries and private
  attachment reads. Backend owner owns these tests and infrastructure changes.

Run the synthetic browser fixture with `node scripts/preview-crm-public-fixture.mjs`.
It binds only 127.0.0.1:5187, serves test names, fails the first child creation with
503 and accepts an explicit retry. It has no real API proxy or production writes.

Recorded local verification (2026-11-13): 114 tests in 33 files passed; default `npm run check` passed; CRM
build also passed with empty VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY.
The new tests cover queue persistence protocol, fingerprint/key changes,
conflict stopping, HTML proxy failures, blocked storage, multipart preservation,
CRM endpoint routing, no Supabase analytics, price agreement, and partial upload
retry. Browser check confirmed actual IndexedDB survival across reload on the
synthetic fixture. Full physical-device/production acceptance is still pending.
