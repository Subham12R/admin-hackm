# ORG. admin panel

[![CI](https://github.com/Subham12R/admin-hackm/actions/workflows/ci.yml/badge.svg)](https://github.com/Subham12R/admin-hackm/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**ORG. · One stop solution for managing events.** The staff and judge portal for events run on
[`hackm-backend`](https://github.com/Subham12R/hackm-backend), currently HackMatrix 2026. Organisers handle
registrations, payments, teams, events and problem statements, judging, results, certificates, check-in, email and
exports here; judges score their assigned projects.

It is a Next.js 16 app with a thin server layer (a "BFF"): every page reads live data from the backend through this
app's own `/api/*` routes, so the browser never sees a token and the backend never needs CORS.

> The rebrand from "HackMatrix admin" to ORG. is planned in [`docs/org-admin-overhaul-plan.md`](docs/org-admin-overhaul-plan.md).
> Some screens still say HackMatrix until that lands.

## Quick start

You need Node.js 20.9 or newer and a running `hackm-backend` (its README has a five-minute local setup, including
`scripts/create_admin.py` for your first super admin).

```sh
npm install
cp .env.example .env.local        # then set BACKEND_URL
npm run dev                       # http://localhost:3000
```

Sign in at `/login` with the super admin you created. Invite everyone else from **Settings** (staff and judges get an
email link to `/invite`).

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `BACKEND_URL` | server only | Base URL of `hackm-backend`, e.g. `http://127.0.0.1:8000` locally or `https://api.hackmatrix.codes`. Never prefix it with `NEXT_PUBLIC_`. |

That is the only setting. Without it, sign-in answers "Login is not configured" and pages show "Admin service is
unavailable". The backend decides what each user can do, the links in staff emails (`ADMIN_APP_URL` on the backend),
and where uploads go.

For uploads (gallery, certificate templates, email attachments) the browser posts straight to the S3 or R2 bucket, so
the bucket's CORS rule must allow this app's origin (see the backend README, "Photo gallery storage").

## How it talks to the backend

```
browser ── fetch("/api/admin/teams") ──▶ src/app/api/admin/[...path] ── Bearer token ──▶ hackm-backend /api/v1/admin/teams
            same-origin, cookies          src/lib/admin-backend.ts        (refresh once on 401)
```

- **Proxies.** `src/app/api/admin/[...path]` and `src/app/api/judge/[...path]` forward any method to
  `/api/v1/admin/*` and `/api/v1/judge/*` (`src/lib/proxy-route.ts` rejects odd path segments). `src/app/api/auth/*`
  wraps login, logout, me, password change, staff invites and invite acceptance.
- **Sessions.** Two httpOnly cookies, `hackmatrix_admin_access` and `hackmatrix_admin_refresh`. Login always uses the
  backend's `portal: "admin"`. When the 15-minute access token expires the proxy refreshes it once, and parallel
  requests share that refresh because refresh tokens are single use.
- **CSRF.** Mutations must be same-origin (`Sec-Fetch-Site` / `Origin` check).
- **Errors.** The proxy turns the backend's `{"detail": ...}` into `{"error": "<message>"}`; `api()` in
  `src/lib/api.ts` throws an `ApiError` with that message and `notify()` toasts it.
- **Data.** TanStack Query (`src/lib/queries.ts`): 15 s stale time, refetch on focus, polling on operational tables,
  and every mutation invalidates the areas it changes plus the overview, analytics, audit log and sidebar counts.
  Response shapes are checked with zod in `src/lib/admin-client.ts`.
- **CSV downloads** pass through the proxy as files.

The backend's API reference documents every route this app calls: request and response schemas, the roles each route
accepts, and error messages. See [`docs/api/README.md`](https://github.com/Subham12R/hackm-backend/blob/master/docs/api/README.md)
and [`docs/api/endpoints.md`](https://github.com/Subham12R/hackm-backend/blob/master/docs/api/endpoints.md) in
`hackm-backend`, or `/docs` on a running API.

## Calling a new backend endpoint

Nothing to add on the server side: the namespace proxies already forward every `/api/v1/admin/*` and
`/api/v1/judge/*` route.

```tsx
"use client"
import { keys, useAdminQuery, useAdminMutation } from "@/lib/queries"
import { notify } from "@/lib/notify"

// GET /api/v1/admin/stages  →  fetch("/api/admin/stages")
const stages = useAdminQuery<{ stages: Stage[] }>(keys.stages, "/api/admin/stages")

// POST /api/v1/admin/stages/{id}/tracks, then refresh the stages list
const addTrack = useAdminMutation(
  (body: { stageId: string; title: string }) => ({
    path: `/api/admin/stages/${body.stageId}/tracks`,
    body: { title: body.title },
  }),
  [keys.stages],
)
notify(addTrack.mutateAsync({ stageId, title }), "Problem statement added")
```

To get types for a response instead of writing them, generate them from the backend's spec:
`npx openapi-typescript ../hackm-backend/docs/api/openapi.json -o src/lib/backend-api.d.ts`.

## Roles

The sidebar (`src/components/admin-sidebar.tsx`) and buttons hide what a role can't use, using the `can` helpers in
`src/lib/queries.ts`. The backend enforces the same rules, so hiding is only for tidiness.

| Role | Sees |
|---|---|
| `SUPER_ADMIN` | Everything, including payments, refunds, staff and the owner tools |
| `EVENT_ADMIN` | Events, problem statements, judging setup, results, announcements, email, exports, check-in |
| `REGISTRATION_ADMIN` | Registrations, team review, check-in |
| `EVALUATION_ADMIN` | Judge assignments and rubrics |
| `SUPPORT_ADMIN` | Contact inbox, email, check-in |
| `VIEWER` | Read-only |
| `JUDGE` | Only `/dashboard/judging`, with anonymous project codes |

Use `useRoles()` (not `useMe()` directly) for role-gated table columns and toolbar buttons: it stays empty until
hydration finishes, which keeps server and client HTML identical.

## Pages

| Path | What it's for |
|---|---|
| `/dashboard` | Overview: registrations, revenue, submissions, what needs attention |
| `/dashboard/registrations`, `/payments`, `/teams` | Registrations, payment review and refunds, team verification and roster edits |
| `/dashboard/check-in` | Finals acceptance and venue arrivals |
| `/dashboard/events` | Events in the edition, problem statements, submission forms, extra time |
| `/dashboard/submissions`, `/evaluations`, `/leaderboard` | Submissions, scores, judging rounds and released results |
| `/dashboard/judging` | A judge's assignments and scorecards |
| `/dashboard/certificates` | Certificate and badge templates, issuing, publishing |
| `/dashboard/contacts`, `/announcements`, `/site-strip`, `/emails`, `/gallery` | Communication |
| `/dashboard/analytics`, `/event-control`, `/exports`, `/logs` | Insights and operations |
| `/dashboard/settings` | Account, staff and invites, owner tools |

## Folder map

```text
src/app/(admin)/dashboard/   pages (one folder per sidebar item)
src/app/(auth)/              login and invite acceptance
src/app/api/                 the BFF: auth routes and the admin/judge namespace proxies
src/components/admin/        page building blocks (kit, drawers, editors, exports)
src/components/charts/       chart primitives
src/lib/admin-backend.ts     session cookies, refresh, proxying
src/lib/api.ts               same-origin fetch helper and formatters
src/lib/queries.ts           TanStack Query hooks, query keys, role helpers
src/lib/admin-client.ts      zod schemas for backend responses
docs/                        plans
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npm run build` / `npm start` | Production build and server |
| `npm run bones` | Recapture loading skeletons (below) |

## Deploy

Any Node host or Vercel works. Set `BACKEND_URL` in the host's environment, serve over HTTPS (the session cookies are
`Secure` in production), and set the backend's `ADMIN_APP_URL` to this app's URL so invite and reset emails link
here.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Login is not configured" or "Admin service is unavailable" | `BACKEND_URL` is missing or the backend is down; check `<BACKEND_URL>/healthz` |
| "Invalid email or password" for a team leader | Leaders sign in on the participant site; this app only accepts staff and judge accounts |
| Signed out after a minute or two, or 401s in a loop | Make sure only one deployment shares these cookies on the domain, and that the backend's signing keys didn't change |
| "Cross-site request refused" | A mutation came from another origin, e.g. a proxy rewriting `Host`. Forward `X-Forwarded-Host` |
| A page or button is missing | Your role doesn't allow it; a super admin can change roles in Settings |
| Upload fails before reaching 100% | The bucket's CORS rule doesn't allow this origin, or the backend has no storage configured |
| Too many login attempts | Wait 15 minutes; the backend locks an email after repeated failures |

For anything else, note the action, the time and the error toast, check the backend logs, and see the backend guide's
[support section](https://github.com/Subham12R/hackm-backend/blob/master/docs/api/README.md#9-support-and-troubleshooting).

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

## Contributing

Bug reports and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, and follow the
[Code of Conduct](CODE_OF_CONDUCT.md). Report security problems privately, as described in
[SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Subham Karmakar.
