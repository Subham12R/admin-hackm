# ORG. admin overhaul plan

**ORG. · One stop solution for managing events**

Status: draft plan, nothing implemented yet. Written 2026-11-11 from the code on `main`
(admin-hackm `e673b7d`, hackm-backend `316d29c`).

This plan covers seven asks:

1. Rename the dashboard to **ORG.** and make the name, logo and colours brandable.
2. Add icons to buttons.
3. Add a floating, draggable pill navigation on the right of long pages (Rounds, Certificates, ...).
4. Clear out clutter and update the UI design so it feels more polished and easier to use.
5. Add an activity center to the top bar (certificate drawing progress, export/download progress, things that need attention).
6. Make the home page configurable, so each admin can hide KPIs and sections they don't want.
7. Check for bugs and errors.

Related work already in flight, which this plan builds on rather than duplicates:

- **Speed up certificate drawing**: the drawing worker itself. The activity center (section 5) only *shows* its progress.
- **Add bulk actions for certificates and badges**: bulk select/publish on the Certificates page. The pill nav (section 3) and button icons (section 2) should land after it, to avoid conflicts on `certificates/page.tsx`.

---

## 0. Where things stand today

| Area | Today |
| --- | --- |
| Name | "HackMatrix Admin" in the tab title, top bar, invite page and metadata; "Admin Dashboard" in the sidebar header; "HackMatrix 2026" in home copy. No logo in the shell. |
| Top bar | A sidebar toggle and the text "HackMatrix Admin". Nothing else. |
| Sidebar | 7 groups, 21 links, amber count pills for work waiting (`/api/admin/attention`, polled every 30s). |
| Home | Fixed layout: welcome line, 4 KPI cards, registrations line chart, registration split pie (hard-coded Adamas/ACM categories), recent registrations table, recent logs table. |
| Long pages | Certificates (871 lines, 8 panels, 3 tabs), Teams (680), Submissions (664), Registrations (570), Emails (494), Rounds & Results (344, 5 stacked panels), Events (302). No in-page navigation. |
| Buttons | `kit.tsx` `Button` / `ConfirmButton` wrap `RichButton`; text only. Only 7 of 23 pages import any `lucide-react` icon. 11 actions are bare underlined text buttons (e.g. "remove" a judge). |
| Background work | Exports poll every 1.5s, but only while the export sheet is open. Certificate drawing status polls only for the visible page of the Issued table. Uploads show a % in the button that started them. Nothing survives navigating away. |
| Type & theme | `font-pixel-square` (Geist Pixel) on almost everything, including tables and form inputs (59 explicit uses). shadcn neutral tokens; no brand colour token. |
| Health | `tsc --noEmit` clean, `eslint` 0 errors / 1 warning, `next build` succeeds (1 font warning). Issues found by reading the code are in section 7. |

---

## 1. Rename to ORG. and make it brandable

### 1.1 What "brandable" means here

One place holds the brand, and every surface reads from it:

| Field | Default | Used in |
| --- | --- | --- |
| `product_name` | `ORG.` | sidebar header, top bar, tab title, login, invite page, metadata |
| `tagline` | `One stop solution for managing events` | login, sidebar header tooltip, metadata description |
| `logo_light` / `logo_dark` | built-in ORG. wordmark (SVG) | sidebar header, collapsed sidebar (mark only), login |
| `mark` | the "O." monogram | collapsed sidebar, favicon, activity toasts |
| `accent` | one OKLCH colour | `--brand`, `--brand-foreground`, focus rings, active nav item, primary buttons, chart line |
| `organisation_name` | `HackMatrix` | copy that refers to the event's organiser ("payments not from HackMatrix") |
| `event_label` | from the active event (`HackMatrix 2026`) | home copy ("Latest registrations for …"), certificate preview defaults |
| `support_email`, `site_url` | `hackmatrix.codes` values | email composer placeholders, login footer link |

Two layers:

- **Product brand** (ORG.): the admin app itself. Lives in `src/lib/brand.ts` as defaults, overridable by env (`NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_ACCENT`, ...) so a fork can rebrand at build time with no code edits.
- **Organisation brand** (HackMatrix / whoever runs the event): stored in the backend so it can change without a deploy. New `org_settings` row (single row, JSON columns), `GET /api/v1/admin/brand` (any staff) and `PUT` (SUPER_ADMIN), logo upload through the existing R2 storage helper. A "Branding" panel on Settings edits it, with a live preview of the sidebar header and login card.

The root layout fetches the brand once on the server (cached, revalidated on save) and passes it through a `BrandProvider`, so the first paint already has the right name and colour (no flash from "ORG." to the custom name).

### 1.2 Hard-coded strings to replace

| File | String |
| --- | --- |
| `src/app/layout.tsx` | metadata title/description |
| `src/app/(admin)/dashboard/layout.tsx` | top bar "HackMatrix Admin" |
| `src/components/admin-sidebar.tsx` | header "Admin Dashboard", `document.title` base |
| `src/components/ui/auth-09.tsx` | login wordmark, link, copy, placeholder email |
| `src/app/(auth)/invite/page.tsx` | "Join HackMatrix Admin" |
| `src/app/(admin)/dashboard/page.tsx` | "HackMatrix 2026", "HackMatrix admin dashboard" |
| `src/app/(admin)/dashboard/emails/page.tsx` | default CTA URL, banner option label, sender fallback domain |
| `src/app/(admin)/dashboard/payments/page.tsx` | "No HackMatrix order" copy (becomes `organisation_name`) |
| `src/lib/credentials.ts` | preview `event_name` |
| `src/lib/theme.ts` | `hackmatrix-admin-theme` storage key (keep reading the old key once, then migrate, so nobody's dark mode resets) |
| `src/app/icon.png` | favicon (1.1 MB PNG today; replace with an SVG mark + a small PNG fallback) |

Cookie names (`hackmatrix_admin_*`) stay as they are. Renaming them signs everyone out for no visible gain.

### 1.3 Registration categories are HackMatrix-specific

The home pie and `registrationCategories` in `src/lib/admin-client.ts` hard-code "Adamas ACM / Adamas only / Outer college / Outer + ACM", and the backend's `RegistrationCategory` enum matches. For ORG. to work for another event, the home widget should read category labels from the API response (the backend already returns them in `registration_split`) instead of a fixed `z.enum`. The backend enum itself can stay for now; making categories configurable per event is a separate, larger backend change and is listed under "Later".

### 1.4 Wordmark

Simple and type-led: "ORG." set in Geist Sans semibold with the full stop in the accent colour. Collapsed sidebar shows "O." only. No illustration, so it reads well at 16px and survives any accent colour.

---

## 2. Icons on buttons

### 2.1 Kit change

Add an optional `icon` prop to `Button`, `ConfirmButton` and `RichButton` (a `LucideIcon`), rendered at 14px before the label with `aria-hidden`. Add `iconOnly` for table-row actions, which then *requires* an `aria-label` (enforced in the type) and shows a tooltip.

`ConfirmButton` swaps its icon on arm (e.g. `Trash2` → `AlertTriangle`) so the second click is visibly different, not just a different word.

### 2.2 Icon vocabulary

One icon per verb, everywhere, so people learn it once:

| Verb | Icon | Examples |
| --- | --- | --- |
| Create / New | `Plus` | New round, New certificate type, New badge, New announcement |
| Save | `Check` | Save minimum, Save layout |
| Edit | `Pencil` | Edit member, Edit credential |
| Delete / Remove | `Trash2` | Delete round, remove judge, remove member |
| Cancel / Close | `X` | Cancel forms |
| Open / Start | `Play` | Open round, Open registration |
| Close / Stop | `Square` | Close round |
| Lock / Unlock | `Lock` / `LockOpen` | Lock results |
| Publish / Release | `Send` | Release results, Publish credentials |
| Unpublish | `EyeOff` | Unpublish results |
| Generate / Redraw | `RefreshCw` | Generate results, Redraw certificates |
| Auto-assign | `Wand2` | Auto-assign judges |
| Upload | `Upload` | Upload artwork, badge image |
| Download / Export | `Download` | Export CSV, download PDF |
| Email | `Mail` | Email teams |
| Accept / Approve | `CircleCheck` | Accept payment, verify team |
| Reject / Decline | `CircleX` | Reject ACM id |
| Refund | `Undo2` | Refund |
| Advance / Shortlist | `ArrowUpRight` | Advance teams |
| Filter / Search | `Filter` / `Search` | table toolbars |
| Copy | `Copy` | copy credential link |
| View / Open page | `ExternalLink` | View public page |

### 2.3 Rollout

Mechanical, page by page, after the kit change. Replace the 11 underlined text buttons (e.g. "remove" a judge on the Rounds board, "Remove from shortlist") with `iconOnly` buttons, and put the destructive ones behind `ConfirmButton` (see bug B5).

---

## 3. Floating pill navigation for long pages

### 3.1 Behaviour

A small vertical pill fixed to the right edge of the content area on long pages.

- **Collapsed** (default): a column of dots, one per section, the current one filled in the accent colour. About 28px wide, so it never covers content.
- **Expanded** on hover or focus: the dots grow labels ("Settings", "Rubric", "Judging board", "Results"), each a link that smooth-scrolls to its section and moves focus to its heading.
- **Scroll spy**: an `IntersectionObserver` on each section marks the one nearest the top as current. The URL hash updates with `history.replaceState` (no scroll jump, no history spam), so a shared link opens at that section.
- **Draggable**: grab the pill's handle (a `GripVertical` at the top) and drag it anywhere vertically, and to the left or right edge. On release it snaps to the nearest edge. Position is saved per page in `localStorage` (wrapped in try/catch). Double-click the handle to reset. Implemented with pointer events and `transform` only (no layout thrash); `touch-action: none` on the handle.
- **Keyboard**: the pill is a `nav` with `aria-label="On this page"`; Tab reaches it, arrow keys move between sections, Enter jumps. Alt+↑/↓ jumps to the previous/next section from anywhere on the page.
- **Badges on dots**: a section can pass a count or tone (e.g. "Judging board · 3 teams short of scorecards") so the pill doubles as a mini status board.
- **Small screens** (< 768px): no floating pill. Instead a sticky horizontal chip row under the page header (scrolls sideways), same sections, same scroll spy.
- Hidden when a page has fewer than 3 sections, and respects `prefers-reduced-motion` (instant jumps, no grow animation).

### 3.2 API

```tsx
<SectionNav>               // renders the pill; reads sections from context
  <Panel section="settings" navLabel="Settings" ...>
  <Panel section="board" navLabel="Judging board" navBadge={{ count: 3, tone: "amber" }} ...>
</SectionNav>
```

`Panel` gains optional `section`, `navLabel` and `navBadge` props; it registers itself with the nearest `SectionNav` context, sets `id` and `scroll-margin-top` (so the sticky top bar doesn't cover the heading). Pages opt in by wrapping their content, nothing else changes.

### 3.3 Where it goes

| Page | Sections |
| --- | --- |
| Rounds & Results | New round · Round settings · Rubric · Judging board · Results (snapshot / live preview) |
| Certificates & badges | Completion · per tab: Types / New type / Detail, Badges / New badge, Issue in bulk, Issued credentials |
| Events | each event card, plus Tracks / Problem statements / Submission form |
| Emails | Compose · Audience · Preview · History |
| Settings | Account · Branding (new) · Staff · Danger zone |
| Event Control | each control panel |
| Analytics | each chart |

The Rounds page also gets a split of the rubric editor out of the "Round settings" panel into its own section, since it is the longest single block on that page.

---

## 4. Declutter and design update

### 4.1 Typography

The pixel font on every table cell, input and description is the biggest readability cost in the app. Proposal:

- **Geist Sans** for body, tables, inputs, descriptions.
- **Geist Mono** for numbers, IDs, codes (`tabular-nums`).
- **Geist Pixel** kept as a brand accent only: the ORG. wordmark, page titles, KPI numbers. That keeps the character without making dense tables hard to scan.

Implementation: remove the blanket `font-pixel-square` from `dashboard/layout.tsx` and the per-page wrappers; add it to `PageHeader` and `MetricsCard` only.

### 4.2 Shell

```
┌ Sidebar ──────┐┌ Top bar ───────────────────────────────────────────────────────────┐
│ ORG.          ││ ☰  Events / Rounds & Results        [⌘K Search]   ⟳ 2   🔔 5   (S) │
│ ▸ HackMatrix  │└────────────────────────────────────────────────────────────────────┘
│   2026  ▾     │
│ ...           │
```

- **Sidebar header**: ORG. wordmark; under it, the active event name as a small switcher label (read-only for now; becomes a real switcher when multi-event lands).
- **Top bar**: breadcrumb (group / page) instead of the static product name; a command/search button (⌘K jumps to any page and searches teams by name; builds on the existing search endpoint); the **activity center** (section 5); the account avatar menu moves up here from the sidebar footer, which frees the sidebar bottom.
- **Sidebar regroup** (21 links → 5 groups, same links):
  - *Overview*: Home, Analytics
  - *People*: Registrations, Payments, Teams, Check-in
  - *Judging*: Submissions, Evaluations, Rounds & Results, My Assignments
  - *Outcomes & comms*: Certificates, Email, Announcements, Site strip, Contacts, Gallery
  - *Admin*: Events, Event Control, Exports, Audit Logs, Settings
  Groups become collapsible, and their open state is remembered.

### 4.3 Pages

- **Panel density**: the double frame (glass shell + inner card) on every panel adds 8px of chrome per panel and makes stacked pages feel busy. Keep the glass shell for the home widgets and page hero only; plain bordered cards elsewhere.
- **One primary action per panel**, shown as a filled accent button with icon; everything else secondary/ghost. Today every button is the same `RichButton` weight, so nothing leads.
- **Empty states** get an icon, one line of copy and the primary action ("No rounds yet. [+ New round]").
- **Destructive actions** consistently use `ConfirmButton` with the trash icon.
- **Status colours**: every coloured text gets a `dark:` pair (see B6), via the existing `tones` map rather than ad hoc classes.
- **Page titles in the browser tab**: "Rounds & Results · ORG." (see B10).
- **Remove dead CSS**: about 1,000 of the 1,431 lines in `globals.css` are keyframes and classes copied from the public site (`home-planet-float`, `hero-meteor-drift`, `typewriter-cursor-blink`, `hud-spin`, `mobile-menu-*` ...) that nothing in admin uses.

### 4.4 Quick wins that need no redesign

- Unify the two `cn` helpers (`cn` npm package in 13 files, `@/lib/utils` elsewhere) on one.
- Replace the 1.1 MB `icon.png` favicon.
- Add the Geist Pixel fallback metrics so the font swap stops shifting layout (the build's only warning).

---

## 5. Activity center in the top bar

### 5.1 What it shows

A bell button in the top bar with a count badge, opening a popover with three tabs:

**Running** (background jobs, with progress bars)

| Item | Source | Progress |
| --- | --- | --- |
| Certificate drawing | `credentials.render_status` grouped by certificate type | "Winners · 34 of 120 drawn · 2 failed", bar, "View failed" link |
| CSV exports | `export_jobs` requested by me, QUEUED/RUNNING/READY | rows built so far, then a **Download** button when READY (with expiry countdown) |
| Email campaigns | campaign send state | "Sent 400 of 1,250" |
| Credential publish + emails | publish job result | "120 published, 118 emailed, 2 still drawing" |
| Uploads in this tab | client side (artwork, badge images, gallery) | upload % that keeps going while you navigate |
| Browser downloads in this tab | client side (large export/PDF downloads via `fetch` + stream) | bytes received / total |

**Needs attention** (the same counts as the sidebar pills, now in one list with a link each): teams to verify, ACM ids to check, payments to review, new messages, submissions without a judge, my scorecards, plus new items: certificates that failed to draw, exports that failed, rounds open with teams short of scorecards, results generated but not released.

**Recent** (my last 20 actions from the audit log, and other admins' actions on things I touched), with "Undo" links where the backend supports it later.

Finished jobs raise a toast once ("Export ready · Download") and stay in Running as "done" for 24 hours or until dismissed. The tab title keeps the existing "(5) ORG." count.

### 5.2 Backend

- `GET /api/v1/admin/activity` returns `{ jobs: [...], attention: {...}, recent: [...] }` in one call, role-filtered like `/attention`. Certificate progress is one grouped `COUNT ... GROUP BY certificate_type_id, render_status` over rows changed in the last 24h, so it stays cheap. Replaces the separate `/attention` poll (keep the old route for a release).
- Poll every 30s when idle and every 3s while any job is RUNNING (the client decides from the last response), only while the tab is visible.
- **Later**: push instead of poll. `src/realtime.py` already does Redis pub/sub + SSE for participant dashboards; add an `admins` channel and publish on job state changes. The poll stays as the fallback, matching the "notifications are a nudge" rule in that module.
- Email campaign progress needs the send loop to record `sent_count` as it goes, if it doesn't already. Check during implementation.

### 5.3 Frontend

- `ActivityProvider` in the dashboard layout holds server jobs (from the query) plus client jobs (uploads/downloads) in one list.
- `useActivity().track({ label, kind, promise, onProgress })` lets any page register a client job; `storage-upload.ts` and the export sheet call it, so their progress shows up in the bell even after the sheet closes (fixes B8).
- The export sheet stops being the only place an export can be downloaded from.

---

## 6. Configurable home page

### 6.1 Widgets

The home page becomes a grid of widgets from a registry. Each widget declares `id`, `title`, `roles` (who may see it), `size` (`kpi` 1 col, `half`, `full`) and `default` (shown on first visit).

| Widget | Default | Notes |
| --- | --- | --- |
| KPI: Registrations | on | existing |
| KPI: Money collected | on (SUPER_ADMIN only) | existing; hidden for non-money roles instead of showing to everyone |
| KPI: Submissions | on | existing |
| KPI: Total users | off | existing |
| KPI: Paid teams | off | already returned by `/overview`, unused |
| KPI: Checked in | off | from check-in counts |
| Needs attention | on | the attention list from section 5 as a card |
| Event timeline | on | registration / submission / results dates with a countdown to the next one |
| Registrations per day | on | existing line chart |
| Registration split | on | existing pie, labels from the API (see 1.3) |
| Judging progress | off | per open round: scorecards submitted / needed |
| Certificates | off | drawn / published / failed |
| Recent registrations | on | existing table |
| Recent activity | on | existing logs table |
| Quick actions | off | buttons to the 4 most used pages, chosen by the admin |

### 6.2 Customise mode

- A **Customise** button (`SlidersHorizontal` icon) in the home header switches the grid into edit mode: every widget shows a visibility toggle and a drag handle; a side sheet lists hidden widgets to add back.
- Reorder by drag (pointer events, same helper as the pill nav) with keyboard fallback (move up/down buttons).
- **Done** saves; **Reset to default** restores.
- Also available: compact/comfortable density, and "Greeting on/off" (the "Welcome back" header).

### 6.3 Where preferences live

Per user, on the server, so they follow the admin across devices: new `admin_preferences` table (`user_id` PK, `home_layout` JSON, `updated_at`), `GET/PUT /api/v1/admin/me/preferences`. `localStorage` caches it for instant first paint. Unknown widget ids are dropped and new widgets appear at their default position, so adding a widget later never breaks a saved layout.

SUPER_ADMIN can also set the **organisation default layout** (stored in `org_settings`) that new admins start from.

---

## 7. Bugs and errors found

Automated checks: `tsc --noEmit` clean; `eslint src` 0 errors, 1 warning (`<img>` on the login page); `next build` succeeds with 1 warning (Geist Pixel font override). Everything below comes from reading the code.

| # | Severity | Where | Problem | Fix |
| --- | --- | --- | --- | --- |
| B1 | Medium | `dashboard/page.tsx` | A signed-in account with neither a staff role nor JUDGE sees the home skeleton shimmer forever: the overview query is disabled, so it is neither loaded nor errored. | Show "You don't have access to this dashboard yet" when roles are loaded and `!staff && !judge`. |
| B2 | Medium | `dashboard/page.tsx` | Judges briefly see the staff home skeleton before the client-side redirect to `/dashboard/judging`. Also reads roles via `useMe()` in a page, the pattern behind the known React #418 hydration error. | Redirect judges on the server in the layout, or in middleware, from the `/me` roles; use `useRoles()` in the page. |
| B3 | Medium | backend `api/admin.py` `/overview` | Overview counts (registrations, submissions, money, series, split) are not filtered by `ACTIVE_EVENT_ID`, while `/attention` is. Harmless with one event row, wrong once ORG. hosts a second event. | Add the active-event filter to every overview query. |
| B4 | Medium | `dashboard/page.tsx` | "Monetary Amount" KPI is shown to every staff role, including VIEWER and SUPPORT_ADMIN, though money pages are SUPER_ADMIN only. | Gate the card with `can.money`, and drop the field from the response for other roles. |
| B5 | Medium | `leaderboard/page.tsx` | Removing a judge from a team on the Rounds board is a single click on a small underlined "remove" link, with no confirmation. "Remove from shortlist" is the same. | `ConfirmButton` with trash icon (section 2). |
| B6 | Low | ~25 places, e.g. `leaderboard/page.tsx` `text-amber-800` | Coloured text with no `dark:` variant is hard to read in dark mode. | Use the `tones` map or add `dark:` pairs. |
| B7 | Low | 11 `Number(event.target.value)` inputs | Clearing a number field turns it into `0` immediately, so you can't clear and retype (e.g. "Judges per team", "Scorecards needed"). | Keep the raw string in state, parse on save. |
| B8 | Low | `export-csv.tsx` | Export progress is only tracked while the export sheet is open; close it and the only way back is the Exports page. | Activity center (section 5). |
| B9 | Low | `certificates/page.tsx` IssuedTab | Drawing status is polled only for the visible page of the table (3s if that page has PENDING rows), so there is no overall "x of y drawn" and failures on other pages go unnoticed. | Activity center totals (section 5). |
| B10 | Low | `admin-sidebar.tsx` | Every tab is titled "HackMatrix Admin"; with several admin tabs open you can't tell them apart. | Per-page titles via `metadata` / `generateMetadata`, count prefix kept. |
| B11 | Low | `metricscard.tsx` | Each KPI card title is an `<h1>`, so the home page has 7 `h1`s. Screen readers lose the page outline. | `h2`/`h3`. |
| B12 | Low | `admin-sidebar.tsx` | If `/api/auth/me` fails with anything other than 401, the sidebar shows its loading shimmer forever with no error or retry. | Error state with a Retry button. |
| B13 | Low | `globals.css` | Lines 1 to ~1,130 hold 88 public-site classes (`hero-*`, `hud-*`, `pixel-vol-*`, `mobile-menu-*`, ...), none referenced anywhere in admin, shipped to every page. | Delete. |
| B14 | Low | `app/layout.tsx` | Geist Pixel has no fallback metrics (the build warning), so text shifts when the font loads. | `adjustFontFallback` / explicit fallback, or limit the pixel font to headings (section 4.1). |
| B15 | Low | `src/app/icon.png` | 1.1 MB favicon. | SVG mark + 32px PNG. |

Not bugs, but worth knowing: the login page is always light (no dark mode), and two different `cn` helpers are in use.

---

## 8. Phases and PRs

Each phase is shippable on its own. Sizes are rough.

| Phase | What | Repos | Size |
| --- | --- | --- | --- |
| **1. Fixes + foundations** | B1 to B15; kit `icon`/`iconOnly`; typography change (4.1); dead CSS removal; per-page titles | admin (+ backend for B3, B4) | M |
| **2. Rebrand** | `brand.ts` + env overrides, ORG. wordmark/mark/favicon, replace hard-coded strings, `org_settings` + Branding panel on Settings, category labels from API | admin + backend (migration) | M |
| **3. Shell** | top bar (breadcrumb, ⌘K, avatar), sidebar regroup + collapsible groups, icon rollout across pages | admin | M |
| **4. Pill nav** | `SectionNav` + `Panel` props, mobile chip row, rollout to the 7 long pages | admin | S–M |
| **5. Activity center** | `/admin/activity` endpoint, `ActivityProvider`, client upload/download tracking, toasts; SSE push later | admin + backend | M–L |
| **6. Configurable home** | widget registry, new widgets, customise mode, `admin_preferences` + org default | admin + backend (migration) | M–L |

Suggested order: 1 → 2 → 3 → 4 → 6 → 5. The activity center goes last because it benefits from the certificate-drawing and bulk-actions work landing first, and its endpoint shape depends on what those threads end up storing.

Backend changes deploy first in each phase (push to `master` auto-deploys), keeping old routes working so the admin can follow.

## 9. Open questions

1. **Brand scope**: is ORG. the admin product's name with HackMatrix as the event it is running (two layers, as above), or should HackMatrix disappear from the admin entirely?
2. **Pill nav dragging**: free vertical position with edge snap (proposed), or only "left edge / right edge"?
3. **Home preferences**: per admin (proposed), or one layout per organisation that only SUPER_ADMIN edits?
4. **Typography**: OK to move body text off the pixel font (4.1)? It is the most visible change in this plan.
5. **Wordmark**: happy with the type-only "ORG." with an accent full stop, or is there a logo to use?

## Later (not in this plan)

- Per-event configurable registration categories (backend enum → table).
- Real multi-event switcher in the sidebar header.
- Undo for reversible admin actions from the activity center.
- SSE push for the activity center.
