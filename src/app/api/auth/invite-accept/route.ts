import { NextResponse } from "next/server"

import { backendErrorMessage, isSameOrigin } from "@/lib/admin-backend"

export async function POST(request: Request) {
  const backend = process.env.BACKEND_URL
  if (!backend) return NextResponse.json({ error: "Invites are not configured." }, { status: 503 })
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 })
  try {
    const payload = await request.json()
    const response = await fetch(new URL("/api/v1/auth/admin/invites/accept", backend), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: payload.token, password: payload.password }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })
    if (response.ok) return NextResponse.json({ ok: true })
    const data = await response.json().catch(() => null)
    const message = response.status === 400 ? "This invite link is invalid or has expired." : backendErrorMessage(data, "The invite could not be accepted.")
    return NextResponse.json({ error: message }, { status: response.status })
  } catch {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 })
  }
}
