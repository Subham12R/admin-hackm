import { proxyAdmin } from "@/lib/admin-backend"

export function GET(request: Request) {
  return proxyAdmin(request, "/api/v1/admin/teams")
}
