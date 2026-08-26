# Deploying JULES & CO to Vercel

One Vercel project serves the whole shop: Next renders the storefront and the
admin, and the existing Express API runs beside it as a Serverless Function.
Configured in [`vercel.json`](../vercel.json).

There is **no committed `.env` template** in this repo, by decision — the
variables live here instead.

---

## How it fits together

Vercel has no long-lived process, so `backend/server.js` — which listens on a
port and serves Next itself — is not used here. [`api/index.js`](../api/index.js)
is the entry point instead: Vercel turns files under `/api` into functions, and
`vercel.json` rewrites `/api/*` onto that one, so Express answers at exactly the
paths it already declares.

**Same origin is the whole point.** The storefront and the API come from one
deployment, so the cookie set by `/api/auth/login` is sent back on every
`/admin` request and `frontend/middleware.ts` can verify it. Splitting them
across two hosts is what used to make admin login silently bounce to the login
page, and it cannot happen in this shape.

Two consequences worth knowing:

- **Nothing runs on a timer.** A function is frozen the moment it responds, so
  the in-process backup and order-expiry schedules never fire. Both are Vercel
  Cron jobs instead (below). Miss this and there are no backups at all, and
  abandoned checkouts hold stock forever.
- **The database connection is cached** on `globalThis` by
  `backend/src/config/db.js`. Without that, every cold start would open another
  Atlas connection until the limit was reached.

## Project settings

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | **the repository root**, not `frontend` |
| Build / Install / Output | leave blank — `vercel.json` sets them |
| Node version | 22.x |

Root Directory has to be the repo root. Point it at `frontend` and the `api/`
function is not deployed, and the whole API disappears.

---

## Environment variables

Set these in **Project → Settings → Environment Variables**, for Production and
Preview.

| Variable | Required | Value | Notes |
| --- | --- | --- | --- |
| `MONGO_URI` | yes | Atlas connection string | Secret. |
| `JWT_SECRET` | yes | long random string | Secret. Signs the admin cookie; `middleware.ts` verifies it. One deployment means one value — the two can no longer drift apart. |
| `JWT_EXPIRES_IN` | no | `30d` | Defaults to `30d`. |
| `NEXT_PUBLIC_API_URL` | yes | `/api` | Same-origin and relative. **Read at build time**, so changing it needs a redeploy. |
| `CRON_SECRET` | yes | long random string | Secret. Vercel sends it as `Authorization: Bearer …` on cron calls. Without it the cron endpoints refuse to run at all. |
| `CLOUDINARY_CLOUD_NAME` | yes | from Cloudinary | Image uploads and backup storage. |
| `CLOUDINARY_API_KEY` | yes | from Cloudinary | Secret. |
| `CLOUDINARY_API_SECRET` | yes | from Cloudinary | Secret. Never reaches the browser. |
| `ADMIN_EMAIL` | yes | your admin login | Secret. Read only when the account is *created*. |
| `ADMIN_PASSWORD` | yes | your admin password | Secret. Changing it later does nothing on its own — use Settings → Administrators. |
| `PAYSTACK_SECRET_KEY` | yes | from Paystack | Secret. Signs webhooks and initialises transactions. Never reaches a browser. |
| `PAYSTACK_PUBLIC_KEY` | yes | from Paystack | Designed to be public. Must be the *same mode* as the secret. |
| `RESEND_API_KEY` | no | from Resend | Secret. Order emails. Unset, the shop works and simply tells nobody anything. |
| `MAIL_FROM` | no | `JULES & CO <orders@your-domain>` | Must be a domain verified in Resend. Unset, mail goes out as `onboarding@resend.dev`. |
| `ORDER_EXPIRY_MINUTES` | no | `60` | How long an unpaid order may hold its stock. |
| `BACKUP_KEEP` | no | `14` | How many backups to retain. |
| `CLIENT_URL` | no | `https://your-domain.com` | Set once you have a custom domain. See below. |

**Do not set `PORT`, `SERVE_FRONTEND` or `API_ORIGIN`.** They belong to the
long-lived-server shape and mean nothing here.

### `CLIENT_URL` and why it matters more than it looks

Unset, everything falls back to `VERCEL_URL` — the deployment's own hostname —
so a fresh deploy works with nothing configured. Three things use it:

- **Where Paystack returns a customer after paying.** Wrong, and someone who has
  just paid lands somewhere unexpected.
- **`metadataBase`**, which makes the share image absolute. WhatsApp, Facebook
  and X all require that, or a shared link previews with no picture.
- **robots.txt and the sitemap**, which name absolute URLs.

So the moment a custom domain is in front of the project, set `CLIENT_URL` to it
— otherwise all three keep pointing at the `vercel.app` address.

---

## Scheduled work

`vercel.json` declares both jobs. They need no setup beyond `CRON_SECRET`.

| Path | Schedule | What it does |
| --- | --- | --- |
| `/api/cron/expire-orders` | every 10 minutes | Returns stock held by checkouts nobody finished. |
| `/api/cron/backup` | daily at 03:00 UTC | Dumps the database to Cloudinary as an authenticated file. |

Cron every ten minutes needs a **Pro** plan; Hobby allows daily only. On Hobby,
change the schedule to daily and accept that stock can be held for up to a day.

Both refuse anything without the right `Authorization` header — they dump the
database and cancel orders, so they are not URLs to leave open. An **unset**
`CRON_SECRET` makes them refuse outright rather than run unauthenticated.

Check they are working under **Project → Cron Jobs**, and confirm the first
backup landed in Cloudinary before trusting it.

---

## First deploy

1. Import the repository into Vercel and set **Root Directory to the repo root**.
2. Add every required variable above.
3. Deploy.
4. Bootstrap the database — this is safe to run against a populated one, every
   write is `$setOnInsert` and nothing is ever deleted:
   ```bash
   npm run seed -w backend      # with MONGO_URI pointing at production
   ```
   It creates the categories, sub-categories, attribute vocabularies and the
   admin user.
5. Sign in at `/admin/login` and change the password under
   **Settings → Administrators**.
6. In the Paystack dashboard, set the webhook URL to
   `https://<your-domain>/api/payments/webhook`. **Without it, payments succeed
   at Paystack and orders sit unpaid**, because the return page is the only
   thing left to notice.

---

## Verifying a deploy

```bash
curl -s https://<your-domain>/api/health          # {"status":"ok"}
curl -s -o /dev/null -w "%{http_code}\n" https://<your-domain>/         # 200
curl -s -o /dev/null -w "%{http_code}\n" https://<your-domain>/admin/dashboard   # 307 → login
curl -s https://<your-domain>/robots.txt          # names your real domain
```

Then sign in to `/admin` and confirm it stays signed in — that is the check that
the cookie is genuinely same-origin.

---

## Local development is unchanged

`npm run dev` still runs two processes: Express on 5000 and Next on 3000.
Nothing in this document changes that, and `api/index.js` is not used locally.

## Before running the production build

`next build` writes to the same `.next` a running dev server is serving from.
Verify without disturbing it:

```bash
NEXT_DIST_DIR=.next-verify npm run build -w frontend
```

It is the only check that exercises prerendering — `tsc`, ESLint and both test
suites have all passed over a build that would have failed.
