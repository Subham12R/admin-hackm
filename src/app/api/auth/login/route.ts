import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const backend = process.env.BACKEND_URL;
  if (!backend) return NextResponse.json({ error: "Login is not configured." }, { status: 500 });
  const payload = await request.json();
  const response = await fetch(`${backend}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: payload.email, password: payload.password, portal: "admin" }),
  });
  if (!response.ok) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  const data = await response.json();
  const next = NextResponse.json({ ok: true });
  next.cookies.set("hackmatrix_admin_access", data.tokens.access_token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 15 * 60 });
  next.cookies.set("hackmatrix_admin_refresh", data.tokens.refresh_token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return next;
}
