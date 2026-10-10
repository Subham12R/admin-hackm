import { namespaceProxy } from "@/lib/proxy-route"

export const { GET, POST, PUT, PATCH, DELETE } = namespaceProxy("/api/v1/admin")
