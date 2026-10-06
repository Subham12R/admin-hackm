import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const ACCESS_COOKIE = "hackmatrix_admin_access"
export const REFRESH_COOKIE = "hackmatrix_admin_refresh"
// The access cookie deliberately outlives its 15-minute JWT: when the token expires the backend
// answers 401 and this proxy refreshes it. If the cookie expired first, refresh could never run.
const SESSION_MAX_AGE = 60 * 60 * 24 * 30

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
}

type Tokens = {
  access: string
  refresh: string
}

// Refresh tokens rotate on use, so two parallel requests must share one refresh call or the
// second one presents an already-revoked token and signs the admin out.
const refreshesInFlight = new Map<string, Promise<Tokens | null>>()

export async function proxyAdmin(request: Request, upstreamPath: string) {
  const backend = process.env.BACKEND_URL
  if (!backend) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 })
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 })
  }

  const cookieStore = await cookies()
  const access = cookieStore.get(ACCESS_COOKIE)?.value
  const refresh = cookieStore.get(REFRESH_COOKIE)?.value
  if (!access && !refresh) {
    return signedOutResponse()
  }

  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await request.text()

  if (access) {
    const firstResponse = await backendRequest(backend, request, upstreamPath, access, body)
    if (firstResponse instanceof NextResponse) return firstResponse
    if (firstResponse.status !== 401) return relay(firstResponse)
  }

  if (!refresh) return signedOutResponse()
  const refreshed = await sharedRefresh(backend, refresh)
  if (!refreshed) return signedOutResponse()

  const retryResponse = await backendRequest(backend, request, upstreamPath, refreshed.access, body)
  if (retryResponse instanceof NextResponse) return retryResponse
  if (retryResponse.status === 401) return signedOutResponse()

  const response = await relay(retryResponse)
  setTokens(response, refreshed)
  return response
}

export function setTokens(response: NextResponse, tokens: Tokens) {
  response.cookies.set(ACCESS_COOKIE, tokens.access, { ...cookieOptions, maxAge: SESSION_MAX_AGE })
  response.cookies.set(REFRESH_COOKIE, tokens.refresh, { ...cookieOptions, maxAge: SESSION_MAX_AGE })
}

export function clearTokens(response: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    response.cookies.set({ name, value: "", ...cookieOptions, maxAge: 0 })
  }
}

export function parseTokens(data: unknown): Tokens | null {
  if (
    typeof data !== "object" ||
    data === null ||
    !("tokens" in data) ||
    typeof data.tokens !== "object" ||
    data.tokens === null ||
    !("access_token" in data.tokens) ||
    !("refresh_token" in data.tokens) ||
    typeof data.tokens.access_token !== "string" ||
    typeof data.tokens.refresh_token !== "string"
  ) {
    return null
  }
  return { access: data.tokens.access_token, refresh: data.tokens.refresh_token }
}

/** Mutations must come from this app's own pages; SameSite=Lax alone still allows top-level POSTs. */
export function isSameOrigin(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return true
  const fetchSite = request.headers.get("sec-fetch-site")
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false
  const origin = request.headers.get("origin")
  if (!origin) return fetchSite === "same-origin"
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || request.headers.get("x-real-ip") || ""
}

export function backendErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail
    if (typeof detail === "string") return detail
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object" && "msg" in detail[0]) {
      return String((detail[0] as { msg: unknown }).msg).replace(/^Value error, /, "")
    }
  }
  return fallback
}

async function sharedRefresh(backend: string, refresh: string) {
  let pending = refreshesInFlight.get(refresh)
  if (!pending) {
    pending = refreshTokens(backend, refresh)
    refreshesInFlight.set(refresh, pending)
    // Keep the settled result briefly so requests that arrive just after still reuse it.
    void pending.finally(() => setTimeout(() => refreshesInFlight.delete(refresh), 10_000))
  }
  return pending
}

async function backendRequest(
  backend: string,
  request: Request,
  upstreamPath: string,
  access: string,
  body: string | undefined
) {
  try {
    return await fetch(new URL(`${upstreamPath}${new URL(request.url).search}`, backend), {
      method: request.method,
      headers: {
        Authorization: `Bearer ${access}`,
        "X-Client-IP": clientAddress(request),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 })
  }
}

async function refreshTokens(backend: string, refresh: string): Promise<Tokens | null> {
  try {
    const response = await fetch(new URL("/api/v1/auth/refresh", backend), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return null
    return parseTokens(await response.json())
  } catch {
    return null
  }
}

async function relay(response: Response) {
  if (response.status === 204) return new NextResponse(null, { status: 204 })
  const text = await response.text()
  try {
    const data = text ? JSON.parse(text) : null
    if (!response.ok) {
      return NextResponse.json(
        { error: backendErrorMessage(data, "The request could not be completed.") },
        { status: response.status }
      )
    }
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 502 })
  }
}

function signedOutResponse() {
  const response = NextResponse.json({ error: "Sign in required." }, { status: 401 })
  clearTokens(response)
  return response
}
