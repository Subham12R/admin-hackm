# Security Policy

## Supported versions

Only the latest commit on `main` is supported. Fixes are not backported.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately in either way:

1. Use GitHub's private reporting: open the **Security** tab of this repository and choose **Report a vulnerability**.
2. Or email **dev@subham12r.me** with the subject `SECURITY: admin-hackm`.

Include what you found, how to reproduce it, the affected files or routes, and the impact you see. Do not include real
participant data or live credentials.

You can expect an acknowledgement within 3 working days and a first assessment within 7 days. We will keep you
updated, and credit you in the fix unless you prefer to stay anonymous.

## Scope

This app is a thin server layer over `hackm-backend`. In scope: session and cookie handling, the `/api/*` proxy routes,
CSRF checks, role-based UI gating, and anything that could expose a token or `BACKEND_URL` to the browser. Backend and
payment issues belong in the [`hackm-backend` policy](https://github.com/Subham12R/hackm-backend/blob/master/SECURITY.md).

Please do not run automated scans against a live production deployment, access data that is not yours, or disrupt
events that are running.
