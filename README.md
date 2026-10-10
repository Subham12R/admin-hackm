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

## Loading skeletons (boneyard)

Data regions are wrapped in `<Bones name="…" loading={…}>` (`src/components/admin/bones.tsx`).
The skeleton shapes are captured from the real rendered pages by
[boneyard](https://github.com/0xGF/boneyard) and committed in `src/bones/`.
Re-capture after adding a `Bones` name or changing a wrapped layout:

1. Run the app against a backend with realistic data (a few dozen teams, a judging round,
   finalists checked in) and sign in as a super admin.
2. Copy the `hackmatrix_admin_refresh` and `hackmatrix_admin_access` cookie values from devtools.
3. `npm run bones -- http://localhost:3000 --force --cookie "hackmatrix_admin_refresh=…" --cookie "hackmatrix_admin_access=…"`
   (add `--cdp 9222` to reuse a Chrome started with `--remote-debugging-port=9222` instead of
   downloading Playwright's browser).

Routes and breakpoints live in `boneyard.config.json`. `scripts/tidy-bones.mjs` runs after the
capture: it caps each skeleton at one screen and turns table cells into text-sized bars.
Only layout boxes are stored, never the captured text.
