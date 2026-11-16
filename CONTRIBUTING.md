# Contributing to the ORG. admin panel

Thanks for helping. This app is the staff and judge portal for events run on
[`hackm-backend`](https://github.com/Subham12R/hackm-backend). Small, focused pull requests are the easiest to review.

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Contributions are licensed under the
[MIT License](LICENSE).

## Before you start

- **Bug or small fix:** open a PR directly.
- **New feature or larger change:** open an issue first so we can agree on the approach before you spend time on it.
- **Security problem:** do not open an issue. Follow [SECURITY.md](SECURITY.md).

## Local setup

You need Node.js 20.9 or newer and a running `hackm-backend` (its README has a five-minute local setup).

```sh
npm install
cp .env.example .env.local        # set BACKEND_URL
npm run dev                       # http://localhost:3000
```

## Before you open a PR

Run the same checks CI runs:

```sh
npm run lint
npx tsc --noEmit
npm run build
```

Notes for this codebase:

- The browser never talks to the backend directly. Calls go through the `/api/*` proxy routes (see the README, "How it
  talks to the backend"). Keep `BACKEND_URL` server-only, never prefix it with `NEXT_PUBLIC_`.
- This project uses a recent Next.js with breaking changes. Check `node_modules/next/dist/docs/` before relying on an
  API you remember from older versions.
- Add or update response schemas (zod) in `src/lib/admin-client.ts` when you consume a new backend field.
- Never commit `.env*` files other than `.env.example`, and never paste real tokens, emails, or participant data into
  issues, screenshots, or tests.

## Pull requests

1. Fork the repo and branch from `main` (`fix/short-description` or `feat/short-description`).
2. Keep the change to one concern. Update the README or `.env.example` if behaviour or configuration changes.
3. Use clear commit messages in the imperative mood ("Fix judge score rounding"). Conventional Commit prefixes
   (`feat:`, `fix:`, `docs:`) are welcome but not required.
4. Fill in the PR template and link the issue it closes.
5. A maintainer will review. Expect requests for changes; they are about the code, not you.

## Reporting bugs

Use the bug report template. Include what you expected, what happened, steps to reproduce, your browser and Node
version, and a screenshot if it is visual. Remove any personal data first.
