# Deploying JULES & CO to Render

Two web services from one repo, defined in [`render.yaml`](../render.yaml).
Create them with **New → Blueprint** and point Render at this repository; it
reads that file and prompts for every secret.

There is **no committed `.env` template** in this repo, by decision — the
variables live here instead.

---

## Environment variables

**One service.** Express serves the API on `/api/*` and hands everything else to
Next, so the shop and the dashboard come from a single Node process.

| Variable | Required | Value | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | yes | `production` | Also what makes the auth cookie `Secure`. |
| `NODE_VERSION` | yes | `22.14.0` | Pinned; matches `.node-version` and `engines`. |
| `SERVE_FRONTEND` | yes | `true` | What makes this one service rather than two. |
| `NEXT_PUBLIC_API_URL` | yes | `/api` | Relative, and now genuinely same-origin. |
| `MONGO_URI` | yes | Atlas connection string | Secret. |
| `JWT_SECRET` | yes | long random string | Secret. Signs the admin cookie; `middleware.ts` verifies it. |
| `JWT_EXPIRES_IN` | no | `30d` | Defaults to `30d`. |
| `CLOUDINARY_CLOUD_NAME` | yes | from Cloudinary | Image uploads and backup storage. |
| `CLOUDINARY_API_KEY` | yes | from Cloudinary | Secret. |
| `CLOUDINARY_API_SECRET` | yes | from Cloudinary | Secret. Never reaches the browser. |
| `ADMIN_EMAIL` | yes | your admin login | Secret. Read only when the account is *created*. |
| `ADMIN_PASSWORD` | yes | your admin password | Secret. Same — changing it later does nothing on its own. |
| `PAYSTACK_SECRET_KEY` | yes | from Paystack | Secret. Signs webhooks, initialises transactions. Never reaches a browser. |
| `PAYSTACK_PUBLIC_KEY` | yes | from Paystack | Designed to be public. Must be the *same mode* as the secret. |
| `ORDER_EXPIRY_MINUTES` | no | `60` | How long an unpaid order may hold its stock before the sweep returns it. |
| `RESEND_API_KEY` | no | from Resend | Secret. Order emails. Unset, the shop works and simply tells nobody anything. |
| `MAIL_FROM` | no | `JULES & CO <orders@your-domain>` | Must be a domain verified in Resend. Unset, mail goes out as `onboarding@resend.dev`. |
| `BACKUP_ENABLED` | yes | `true` | Atlas M0 has no automated backups. |
| `BACKUP_HOUR` / `BACKUP_KEEP` | no | `3` / `14` | Hour of day, and how many to retain. |

**Do not set `PORT`.** Render injects it, `server.js` reads it, and sets
`API_ORIGIN` to its own loopback address so server components can reach the API.

**Set `CLIENT_URL` once you have a custom domain.** It used to feed only the
API's CORS allow-list, which one origin makes moot — but it is now also where
Paystack returns a customer after they pay. Unset, that falls back to Render's
own `RENDER_EXTERNAL_URL`, so the `.onrender.com` deployment works untouched.
Point a custom domain at the service and leave this unset, and paying customers
land back on the `onrender.com` address instead of your shop.

## Order email

Optional, and off until you add a key — the shop takes money either way, it just
tells nobody about it.

1. Create a [Resend](https://resend.com) account. The free tier is 3,000 emails
   a month, which is far more than this shop will send.
2. Copy the API key into `RESEND_API_KEY` on Render.
3. Leave `MAIL_FROM` unset to begin with. Mail then comes from
   `onboarding@resend.dev`, which works immediately with no DNS at all — good
   enough to prove the flow, not good enough for a customer to see.
4. When you have a domain, verify it in Resend (three DNS records) and set
   `MAIL_FROM` to something like `JULES & CO <orders@julesandco.com>`.

Five emails are sent, each once per order: payment received, order confirmed,
on its way, delivered, and cancelled. What has been sent is recorded on the
order and shown in the admin under each order's Emails sent, so you never have
to go to Resend to answer "have they heard from us?".

## Why one service

The two were split for one reason: the auth cookie has to be same-origin. The
API sets it and `frontend/middleware.ts` reads it back to guard `/admin`, and
across two hosts the browser would never send it — `onrender.com` is on the
Public Suffix List, so a shared parent-domain cookie is not available either.
The `/api` rewrite existed purely to work around that.

Serving both from one process makes it true by construction. The proxy,
`API_ORIGIN` as a deploy variable, the bare-hostname normalising and CORS all
stop being things that can be misconfigured. **`JWT_SECRET` is one value rather
than two that must match** — the single most costly misconfiguration in the old
shape, which presented as admin login silently bouncing to the login page.

What is given up is failure isolation, and here that is mostly illusory: every
storefront page render calls the API, so if the API is down the shop is broken
whether or not it is a separate service.

Server components fetch the API over HTTP on the loopback address rather than
calling controllers directly. Slightly wasteful, but it keeps `lib/api.ts`
identical in both shapes, and splitting back apart stays easy — set
`SERVE_FRONTEND` to false and deploy the frontend separately again.

## First deploy

1. **Allow Render in MongoDB Atlas.** Atlas blocks unknown IPs by default, and
   Render's outbound addresses are not static on the free plan. Under
   *Network Access*, add `0.0.0.0/0`, or pin Render's static outbound IPs on a
   paid instance. Without this the API boots and dies on `connectDB`.

2. **Deploy the blueprint** and let both services build.

3. **Bootstrap the database** — from a local machine with `MONGO_URI` pointed
   at production:

   ```bash
   npm run seed -w backend
   ```

   Categories, sub-categories, the attribute vocabularies and the admin user,
   in one command. It **never deletes and never overwrites**, so it is safe to
   run against a database that already has products, and a second run reports
   no changes. Add `--with-examples` for a few draft jewellery pieces to look at.

   The admin account is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Those are
   read only when the user is *created*, so editing them later changes nothing —
   to change a password afterwards, either use **Settings → Administrators** in
   the dashboard, or run:

   ```bash
   npm run set-admin-password -w backend
   ```

4. **Log in** at `https://<web-host>/admin/login`, add an administrator or two
   under Settings, and publish a product.

---

## Moving to a paid instance later

**Nothing has to be rebuilt or migrated.** Changing a Render service's instance
type is an in-place setting — Settings → Instance Type → pick the new one — and
the service redeploys onto it keeping the same URL, environment variables,
custom domains and deploy history. There is no second service to create and no
data to move.

The reason it is that simple here is worth stating plainly: **the database is not
on Render.** Products, orders, customers, reviews and site content all live in
MongoDB Atlas, which the API connects to over `MONGO_URI`. Render only runs the
two Node processes. Resizing them cannot touch the data, because the data was
never there.

Upgrading Atlas later is the same kind of change: its shared tiers scale in place
from the Atlas dashboard. A move between *cloud providers or regions* would be a
real migration; changing tier is not.

Practically, upgrade **before** launch rather than after, because of the sleeping
described below.

## Custom domain

Do this once both services are deployed and working on their `onrender.com`
URLs.

1. In Render, open the service → Settings → Custom Domains → add both
   `julesandco.com` and `www.julesandco.com`. There is only one service, so
   there is nothing to choose between.
3. At the registrar, add the records Render shows — typically a `CNAME` for
   `www` and an `ALIAS`/`ANAME` (or Render's IP via `A`) for the apex. Render
   issues the TLS certificate automatically once DNS resolves.
4. **Nothing in the app needs changing.** `NEXT_PUBLIC_API_URL` stays `/api`
   because it is relative, and everything is same-origin by construction.

> Check whether your plan allows custom domains before buying the domain —
> Render's free tier limits have changed over time, and this is worth confirming
> in their current pricing page rather than taking on trust here.

## Payments

Paystack, in GHS. The flow is deliberately ordered:

1. The order is created first, `pending`, with its stock held. An abandoned
   checkout leaves an order the admin can see and cancel — not a charge with no
   record of what it was for.
2. `POST /api/payments/initialise` starts a Paystack transaction using the order
   number as the reference, so every payment traces back to an order and back
   again. The customer is sent to Paystack's page.
3. **Paystack's signed webhook is what marks an order paid** — never the
   browser. A client can claim success; only an HMAC-SHA512 signature made with
   your secret key is evidence.
4. The return page polls `/api/payments/status/:orderNumber`, which re-verifies
   against Paystack if the webhook has not landed yet. The redirect is never
   trusted on its own.

**Point Paystack at the webhook** — dashboard → Settings → API Keys & Webhooks →
Webhook URL:

```
https://<your-host>/api/payments/webhook
```

Amounts are converted to pesewas in one place (`utils/paystack.js`), because a
factor-of-100 error is the classic first bug and it should only be possible to
make it once. The webhook checks the amount Paystack reports against the order
total and **refuses to mark it paid if they differ** — a mismatch means
something is wrong, and shipping goods for the wrong money is worse than a
failed payment.

Switching from test to live is two environment variables. Nothing in the code
knows the difference.

## Backups

MongoDB Atlas M0 has **no automated backups**, so the API takes its own — once a
day at 03:00, stored in Cloudinary as an authenticated raw file.

Most of this database does not need protecting: `npm run seed -w backend`
regenerates the categories, sub-categories, attribute vocabularies and admin
user, and the site content has defaults in `utils/contentSlots.js`. Three
collections cannot be rebuilt by anything — **products**, entered by hand;
**orders**, the trading record; and **reviews**, customers' own words. Those are
what this exists for.

Product photographs are not in the dump. They live in Cloudinary and the
database only holds their URLs, so a restore brings the catalogue back with its
images as long as that account is intact.

| Variable | Default | |
| --- | --- | --- |
| `BACKUP_ENABLED` | off | `true` on Render. Off elsewhere so a developer machine never backs up the live database by accident. |
| `BACKUP_HOUR` | `3` | Hour of day, server time. |
| `BACKUP_KEEP` | `14` | How many to retain; older ones are deleted. |

```bash
npm run backup -w backend             # take one now
npm run backup -w backend -- --list   # what is stored
npm run restore -w backend            # preview restoring the newest
npm run restore -w backend -- --confirm
```

**Restore previews by default.** It prints what is in the backup against what is
live and writes nothing without `--confirm` — the moment you need it you will be
under pressure, so the safe thing is what happens if you type the command wrong.

The dumps carry customer names, emails, phone numbers and delivery addresses, so
they are uploaded as `type: "authenticated"`. Verified: an unsigned request for
the asset returns **401**, a signed one returns 200. Do not change that to
`upload`, which would make them public to anyone who guesses the filename.

Each archive is verified twice — after writing and after upload — by gunzipping
it and checking the document counts match its own header. A dump that truncated
would otherwise upload happily and look like protection until the day it was
needed.

## Notes

- **Free-plan services sleep** after inactivity. The first request after a spin-down
  takes 30s or so, and because the storefront reads the API on every render,
  a cold web service *and* a cold API compound. Consider paid instances before launch.
- **The web service builds with `npm ci --include=dev`.** `NODE_ENV=production`
  is set on the service, which makes npm omit devDependencies — and `typescript`,
  `tailwindcss`, `postcss` and `autoprefixer` are devDependencies that are needed
  to *build*. Drop the flag and the first deploy fails on a missing TypeScript
  compiler. The API keeps plain `npm ci`: it needs none of them at runtime.
- **Node is pinned to 22.14.0** in `.node-version`, `engines`, and `NODE_VERSION`
  on both services, so a change to Render's default cannot move the runtime under
  the app between deploys.
- **Health check** is `/api/health` on the API service, defined in `backend/src/app.js`.
- **`trust proxy` is enabled** on the API. Render terminates TLS at its edge and
  forwards over HTTP; without it Express sees an insecure request and refuses to
  set `secure` cookies, so login would silently never persist.
- **Storefront reads are uncached** (`cache: "no-store"`), so an admin change is
  live immediately. That is one API query per render — if traffic makes that
  expensive, switch to `next: { revalidate, tags: ["catalog"] }` plus
  `revalidateTag` on the admin save path.
- **Cloudinary uploads go browser → Cloudinary directly**, signed by the API. The
  API secret never reaches the client, and `res.cloudinary.com` is already
  allowed in `next.config.js`.

### Not deployment variables

`E2E_BASE_URL`, `E2E_API_URL`, `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` are
Playwright overrides for local test runs only. The suite otherwise reads the
admin credentials straight from `backend/.env`, so they are normally unset.
