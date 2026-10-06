import { proxyAdmin } from "@/lib/admin-backend"

export function POST(request: Request) {
  return proxyAdmin(request, "/api/v1/auth/password/change")
}
