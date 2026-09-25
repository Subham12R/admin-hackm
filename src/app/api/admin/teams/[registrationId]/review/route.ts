import { proxyAdmin } from "@/lib/admin-backend"

export async function POST(
  request: Request,
  context: { params: Promise<{ registrationId: string }> }
) {
  const { registrationId } = await context.params
  return proxyAdmin(
    request,
    `/api/v1/admin/teams/${encodeURIComponent(registrationId)}/review`
  )
}
