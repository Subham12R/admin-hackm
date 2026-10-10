import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { clearTokens, isSameOrigin, REFRESH_COOKIE } from "@/lib/admin-backend"

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 })
  const backend = process.env.BACKEND_URL
  const refresh = (await cookies()).get(REFRESH_COOKIE)?.value
  if (backend && refresh) {
    await fetch(new URL("/api/v1/auth/logout", backend), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      signal: AbortSignal.timeout(5_000),
    }).catch(() => undefined)
  }
  const response = NextResponse.json({ ok: true })
  clearTokens(response)
  return response
}
