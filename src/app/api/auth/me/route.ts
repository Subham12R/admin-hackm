import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const backend = process.env.BACKEND_URL;
  const access = (await cookies()).get("hackmatrix_admin_access")?.value;
  if (!backend || !access) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const response = await fetch(`${backend}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${access}` },
    cache: "no-store",
  });
  return NextResponse.json(await response.json(), { status: response.status });
}
