# Deploying JULES & CO to Render

Two web services from one repo, defined in [`render.yaml`](../render.yaml).
Create them with **New → Blueprint** and point Render at this repository; it
reads that file and prompts for every secret.

There is **no committed `.env` template** in this repo, by decision — the
variables live here instead.

---

## Environment variables

### API service — `jules-and-co-api`

| Variable | Required | Value | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | yes | `production` | Turns on secure cookies and locks CORS to `CLIENT_URL`. Set by the blueprint. |
| `PORT` | — | *(injected)* | Render sets it; `backend/server.js` already reads it. Do not set by hand. |
| `MONGO_URI` | yes | `mongodb+srv://…/jules-and-co` | Include the database name. See the Atlas note below. |
| `JWT_SECRET` | yes | long random string | **Must be byte-identical to the web service's.** |
| `JWT_EXPIRES_IN` | no | `30d` | Defaults sensibly if omitted. |
| `CLIENT_URL` | yes | web service host | Comma-separated list accepted. The blueprint wires it from the web service automatically. |
| `CLOUDINARY_CLOUD_NAME` | yes | from Cloudinary | Product image uploads. |
| `CLOUDINARY_API_KEY` | yes | from Cloudinary | |
| `CLOUDINARY_API_SECRET` | yes | from Cloudinary | Signs upload requests. Never exposed to the browser. |
| `ADMIN_EMAIL` | yes | `admin@julesandco.com` | Only read when the admin user is **created**. |
| `ADMIN_PASSWORD` | yes | strong password | Same — changing it later does nothing on its own. See "First deploy". |

### Web service — `jules-and-co-web`

| Variable | Required | Value | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | yes | `production` | Set by the blueprint. |
| `NEXT_PUBLIC_API_URL` | yes | `/api` | Relative on purpose — the browser calls this app, which proxies onward. |
| `API_ORIGIN` | yes | API service host | Proxy target, and what server components call directly. A bare hostname is fine; the scheme is added if missing. |
| `JWT_SECRET` | yes | **same as the API's** | The API signs the auth cookie, `frontend/middleware.ts` verifies it. |

> **The two `JWT_SECRET` values must match exactly.** If they differ, admin login
> appears to succeed and then every `/admin/*` route bounces back to the login
> page with no error shown — it is indistinguishable from a wrong password.

---

## Why the API is proxied

The browser never talks to the API host directly. `frontend/next.config.js`
rewrites `/api/*` to `API_ORIGIN`.

This is not a preference. The API sets the auth cookie, and
`frontend/middleware.ts` reads that cookie **server-side on the web service** to
guard `/admin/*`. Deployed as two services those are different hostnames, so the
browser would never send the cookie to the web service and the admin dashboard
would be permanently locked out. `onrender.com` is on the Public Suffix List, so
a shared parent-domain cookie is not an option either.

Routing browser traffic through `/api` makes everything same-origin, which also
means CORS stops mattering and the API host is never exposed to the client.

If you later move to a custom domain, `jules.com` + `api.jules.com` with a
`.jules.com` cookie would also work — but the proxy needs no DNS and works today.

---

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

1. **Point the domain at the web service, not the API.** Customers only ever talk
   to the storefront; the API is reached through it via the `/api` rewrite. The
   API can stay on its `onrender.com` hostname indefinitely.
2. In Render, open the **web service** → Settings → Custom Domains → add both
   `julesandco.com` and `www.julesandco.com`.
3. At the registrar, add the records Render shows — typically a `CNAME` for
   `www` and an `ALIAS`/`ANAME` (or Render's IP via `A`) for the apex. Render
   issues the TLS certificate automatically once DNS resolves.
4. **Nothing in the app needs changing.** `NEXT_PUBLIC_API_URL` stays `/api`
   because it is relative, and `API_ORIGIN` still points at the API service.
   The auth cookie stays same-origin, which is the whole reason for the proxy.
5. Set `CLIENT_URL` on the **API** service to the new domain so its CORS list is
   correct for any direct call. Not required for the storefront, which is
   same-origin, but it keeps the header honest.

> Check whether your plan allows custom domains before buying the domain —
> Render's free tier limits have changed over time, and this is worth confirming
> in their current pricing page rather than taking on trust here.

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
