import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ registrationId: string }> }) {
  const backend = process.env.BACKEND_URL;
  const access = (await cookies()).get("hackmatrix_admin_access")?.value;
  const { registrationId } = await context.params;
  if (!backend || !access) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const response = await fetch(`${backend}/api/v1/admin/submissions/${registrationId}/assign`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "content-type": "application/json" },
    body: await request.text(),
  });
  return NextResponse.json(await response.json(), { status: response.status });
}
