import { NextResponse } from "next/server"

import { proxyAdmin } from "@/lib/admin-backend"

type Context = { params: Promise<{ path: string[] }> }

/** One proxy per backend namespace; the backend authorizes every call. */
export function namespaceProxy(prefix: "/api/v1/admin" | "/api/v1/judge") {
  async function handler(request: Request, context: Context) {
    const { path } = await context.params
    // Reject dot segments and anything that is not a plain path component.
    if (!path.length || path.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))) {
      return NextResponse.json({ error: "Not found." }, { status: 404 })
    }
    return proxyAdmin(request, `${prefix}/${path.join("/")}`)
  }
  return { GET: handler, POST: handler, PUT: handler, PATCH: handler, DELETE: handler }
}
