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

3. **Seed the catalogue vocabulary** — from a local machine with `MONGO_URI`
   pointed at production:

   ```bash
   npm run seed:attributes -w backend   # attribute groups + option lists
   npm run pivot -w backend             # categories, sub-categories, vocabularies
   ```

   Both are idempotent; a second run reports no changes.

4. **Set the admin password.** `ADMIN_EMAIL`/`ADMIN_PASSWORD` are read only when
   the user is *created*, so editing them later changes nothing:

   ```bash
   npm run set-admin-password -w backend
   ```

   It creates the account if missing, updates it if it exists, verifies the
   result, and never prints the password.

5. **Log in** at `https://<web-host>/admin/login` and publish a product.

> **Do not run `npm run seed -w backend`.** `seedData.js` still writes the
> pre-pivot variant shape and would create products with no variants. It needs
> rewriting before it is safe.

---

## Notes

- **Free-plan services sleep** after inactivity. The first request after a spin-down
  takes 30s or so, and because the storefront reads the API on every render,
  a cold web service *and* a cold API compound. Consider paid instances before launch.
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
