import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function forward(path: string, request?: Request) {
  const backend = process.env.BACKEND_URL;
  const access = (await cookies()).get("hackmatrix_admin_access")?.value;
  if (!backend || !access) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const response = await fetch(`${backend}${path}`, {
    method: request ? "POST" : "GET",
    headers: { Authorization: `Bearer ${access}`, "content-type": "application/json" },
    body: request ? await request.text() : undefined,
    cache: "no-store",
  });
  return NextResponse.json(await response.json(), { status: response.status });
}

export function GET() {
  return forward("/api/v1/admin/evaluations");
}

export function POST(request: Request) {
  return forward("/api/v1/admin/evaluations", request);
}
