import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const ACCESS_COOKIE = "hackmatrix_admin_access"
const REFRESH_COOKIE = "hackmatrix_admin_refresh"
const ACCESS_MAX_AGE = 15 * 60
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30

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

export async function proxyAdmin(request: Request, upstreamPath: string) {
  const backend = process.env.BACKEND_URL
  const cookieStore = await cookies()
  const access = cookieStore.get(ACCESS_COOKIE)?.value

  if (!backend) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 })
  }

  if (!access) {
    return signedOutResponse()
  }

  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await request.text()
  const firstResponse = await backendRequest(backend, request, upstreamPath, access, body)

  if (firstResponse instanceof NextResponse) {
    return firstResponse
  }

  if (firstResponse.status !== 401) {
    return relay(firstResponse)
  }

  const refresh = cookieStore.get(REFRESH_COOKIE)?.value
  if (!refresh) {
    return signedOutResponse()
  }

  const refreshed = await refreshTokens(backend, refresh)
  if (!refreshed) {
    return signedOutResponse()
  }

  const retryResponse = await backendRequest(
    backend,
    request,
    upstreamPath,
    refreshed.access,
    body
  )
  if (retryResponse instanceof NextResponse) {
    return retryResponse
  }
  if (retryResponse.status === 401) {
    return signedOutResponse()
  }

  const response = await relay(retryResponse)
  setTokens(response, refreshed)
  return response
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
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
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

function parseTokens(data: unknown): Tokens | null {
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

async function relay(response: Response) {
  const text = await response.text()
  try {
    return NextResponse.json(text ? JSON.parse(text) : null, { status: response.status })
  } catch {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 502 })
  }
}

function signedOutResponse() {
  const response = NextResponse.json({ error: "Sign in required." }, { status: 401 })
  clearTokens(response)
  return response
}

function setTokens(response: NextResponse, tokens: Tokens) {
  response.cookies.set(ACCESS_COOKIE, tokens.access, {
    ...cookieOptions,
    maxAge: ACCESS_MAX_AGE,
  })
  response.cookies.set(REFRESH_COOKIE, tokens.refresh, {
    ...cookieOptions,
    maxAge: REFRESH_MAX_AGE,
  })
}

function clearTokens(response: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    response.cookies.set({ name, value: "", ...cookieOptions, maxAge: 0 })
  }
}
