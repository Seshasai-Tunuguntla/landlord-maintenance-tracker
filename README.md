# Landlord/Tenant Maintenance Tracker

Full-stack app: React (Vite) frontend, Node/Express backend, PostgreSQL database via Prisma.

## Project structure

```
client/   React frontend (Vite)
server/   Express API + Prisma schema/migrations + tests
```

## First-time setup

1. Make sure PostgreSQL is running (`pg_isready`) and the `landlord_maintenance` database exists.
2. Backend:
   ```
   cd server
   npm install
   npx prisma migrate dev
   npm run dev        # http://localhost:4000
   ```
3. Frontend (separate terminal):
   ```
   cd client
   npm install
   npm run dev         # http://localhost:5173
   ```

The frontend dev server proxies `/api` and `/uploads` requests to `http://localhost:4000`, so just open http://localhost:5173.

## How it works

- Register as a **Landlord**, create a property — you get a join code.
- Register as a **Tenant**, join the property using that code.
- Tenant submits a maintenance request (title, description, priority, optional photo).
  - Priority is **Low / Medium / High**, chosen by the tenant.
  - If the title/description contains urgent keywords (e.g. "no heat", "gas leak", "flooding"), the request is auto-flagged **Urgent** — overriding whatever the tenant picked — and sorted to the top of the landlord's list.
- Landlord updates status: Open → In Progress → Resolved.
- Every status change (including the initial "Open") is recorded in `StatusHistoryEntry` with who made it and when, giving a full audit trail visible on both dashboards.

## Security & validation

- Passwords hashed with bcrypt; auth via JWT (7-day expiry).
- `requireAuth` / `requireRole` middleware gate every non-public route; ownership is re-checked in each handler (a landlord can only see/update requests on properties they own, a tenant only their own requests).
- Request bodies are validated with [Zod](https://zod.dev) (`server/src/validation/schemas.js`) — bad input returns a `400` with a specific message instead of a raw error.
- `helmet` sets standard security headers; CORS is restricted to the origin(s) listed in `CLIENT_ORIGIN`.
- Login/register are rate-limited (20 requests / 15 min per IP) to slow brute-force attempts.
- Photo uploads are limited to 5MB and must be an image MIME type.

## Testing

```
cd server
npm test
```

Runs against a separate `landlord_maintenance_test` database (create it once with `createdb landlord_maintenance_test`; `npm test` applies migrations to it automatically via `pretest`). Covers:
- `tests/priority.test.js` — unit tests for the urgent-keyword detection logic
- `tests/auth.test.js` — register/login/me validation and error cases
- `tests/requests.test.js` — property join flow, role-based access control, priority/urgent-override behavior, status-history + `changedBy` tracking

You can still poke the API manually with Thunder Client/curl against the dev server on port 4000.

## Environment variables (server/.env)

```
DATABASE_URL="postgresql://<user>@localhost:5432/landlord_maintenance"
JWT_SECRET="change-me-in-production"
PORT=4000
CLIENT_ORIGIN="http://localhost:5173"   # comma-separated if you need more than one
```

`server/.env.test` holds the equivalent config for the test database and is loaded automatically by `npm test`.

## Deployment

- **API + database → Render.** `render.yaml` is a Blueprint: in Render choose *New → Blueprint*, pick this repo, and it creates the Postgres database and the API service together (migrations run on every deploy; `JWT_SECRET` is generated). It asks for `CLIENT_ORIGIN` — enter your Vercel URL.
- **Frontend → Vercel.** Import the repo with **Root Directory = `client`**. `client/vercel.json` forwards `/api` and `/uploads` to the Render API, so the browser only ever talks to the Vercel domain. If Render gives the API a different URL than `landlord-maintenance-api.onrender.com`, update the two URLs in `client/vercel.json`.
- On Render's free plan, uploaded photos are stored on the server's disk and are lost when the service restarts or redeploys. Moving photos to cloud storage (e.g. Cloudinary or S3) would fix that.

## Not done yet

- No CI pipeline running the test suite on push.
- Photos aren't in permanent cloud storage yet (see above).
