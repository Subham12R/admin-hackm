import { NextResponse } from "next/server"

import { clientAddress, isSameOrigin, parseTokens, setTokens } from "@/lib/admin-backend"

export async function POST(request: Request) {
  const backend = process.env.BACKEND_URL
  if (!backend) return NextResponse.json({ error: "Login is not configured." }, { status: 503 })
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 })
  try {
    const payload = await request.json()
    const response = await fetch(new URL("/api/v1/auth/login", backend), {
      method: "POST",
      headers: { "content-type": "application/json", "X-Client-IP": clientAddress(request) },
      body: JSON.stringify({ email: payload.email, password: payload.password, portal: "admin" }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })
    if (response.status === 429) {
      return NextResponse.json({ error: "Too many attempts. Wait 15 minutes and try again." }, { status: 429 })
    }
    if (!response.ok) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
    const tokens = parseTokens(await response.json())
    if (!tokens) return NextResponse.json({ error: "Login is unavailable." }, { status: 502 })
    const next = NextResponse.json({ ok: true })
    setTokens(next, tokens)
    return next
  } catch {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 })
  }
}
