# Landlord/Tenant Maintenance Tracker

Full-stack app: React (Vite) frontend, Node/Express backend, PostgreSQL database via Prisma.

## Project structure

```
client/   React frontend (Vite)
server/   Express API + Prisma schema/migrations
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
- Tenant submits a maintenance request (title, description, optional photo).
- If the title/description contains urgent keywords (e.g. "no heat", "gas leak", "flooding"), the request is auto-flagged `URGENT` and sorted to the top of the landlord's list.
- Landlord updates status: Open → In Progress → Resolved. Every change is recorded in `StatusHistoryEntry` for a full audit trail.

## Environment variables (server/.env)

```
DATABASE_URL="postgresql://<user>@localhost:5432/landlord_maintenance"
JWT_SECRET="change-me-in-production"
PORT=4000
```
