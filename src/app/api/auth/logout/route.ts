import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const backend = process.env.BACKEND_URL;
  const refresh = (await cookies()).get("hackmatrix_admin_refresh")?.value;
  if (backend && refresh) {
    await fetch(`${backend}/api/v1/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  for (const name of ["hackmatrix_admin_access", "hackmatrix_admin_refresh"]) {
    response.cookies.set({ name, value: "", httpOnly: true, maxAge: 0, path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  }
  return response;
}
