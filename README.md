# admin-hackm

HackMatrix staff and judge portal (Next.js 16). Every page reads live data from `hackm-backend`
through this app's same-origin API routes; the browser never sees tokens.

## Configuration

| Variable | Purpose |
|---|---|
| `BACKEND_URL` | Server-only base URL of `hackm-backend`, for example `http://127.0.0.1:8092`. |

## How it talks to the backend

- `src/app/api/admin/[...path]` and `src/app/api/judge/[...path]` proxy to `/api/v1/admin/*` and
  `/api/v1/judge/*`. The backend authorizes every call by role.
- Sessions are two httpOnly cookies. An expired access token is refreshed once per refresh token
  (`src/lib/admin-backend.ts`), so parallel requests never sign the user out.
- Mutations must be same-origin (`Origin` / `Sec-Fetch-Site` check).
- Data is cached with TanStack Query (`src/lib/queries.ts`): 15s stale time, refetch on focus,
  polling on operational tables, and every mutation invalidates the areas it changes plus the
  overview, analytics, and audit log.

## Roles

Navigation hides pages a role cannot use; the backend enforces the same rules.
Judges only see `/dashboard/judging`, with anonymous project codes.

## Scripts

`npm run dev`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
