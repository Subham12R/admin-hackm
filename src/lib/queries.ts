"use client"

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query"

import { api } from "@/lib/api"

/**
 * Query keys are namespaced so a mutation can invalidate everything it affects.
 * Every write invalidates its own area plus the aggregates (overview, analytics, logs).
 */
export const keys = {
  me: ["me"] as const,
  overview: ["overview"] as const,
  analytics: ["analytics"] as const,
  registrations: (params: string) => ["registrations", params] as const,
  registration: (id: string) => ["registration", id] as const,
  paymentsReview: ["payments-review"] as const,
  teams: (params: string) => ["teams", params] as const,
  submissions: (stage = "", track = "") => ["submissions", stage, track] as const,
  stages: ["stages"] as const,
  evaluators: ["evaluators"] as const,
  evaluations: ["evaluations"] as const,
  logs: (params: string) => ["logs", params] as const,
  event: ["event"] as const,
  challenge: ["challenge"] as const,
  announcements: ["announcements"] as const,
  rounds: ["rounds"] as const,
  board: (id: string) => ["board", id] as const,
  results: (id: string) => ["results", id] as const,
  contacts: (params: string) => ["contacts", params] as const,
  contact: (id: string) => ["contact", id] as const,
  staff: ["staff"] as const,
  teamInvites: ["team-invites"] as const,
  emailCampaigns: ["email-campaigns"] as const,
  judgeAssignments: ["judge-assignments"] as const,
  checkins: (search: string) => ["checkins", search] as const,
  gallery: ["gallery"] as const,
  certificateTypes: (stage: string) => ["certificate-types", stage] as const,
  badges: ["badges"] as const,
  candidates: (body: string) => ["candidates", body] as const,
  credentials: (params: string) => ["credentials", params] as const,
  judgeAssignment: (id: string) => ["judge-assignment", id] as const,
}

const AGGREGATES: QueryKey[] = [["overview"], ["analytics"], ["logs"]]

export function useAdminQuery<T>(key: QueryKey, path: string | null, options?: { refetchInterval?: number; enabled?: boolean }) {
  return useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api<T>(path as string, { signal }),
    enabled: path !== null && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval,
    refetchIntervalInBackground: false,
  })
}

/** A mutation that refreshes the listed areas (and aggregates) once the server confirms it. */
export function useAdminMutation<TBody, TResult = unknown>(
  build: (body: TBody) => { path: string; method?: string; body?: unknown },
  invalidate: QueryKey[]
) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: TBody) => {
      const request = build(body)
      return api<TResult>(request.path, { method: request.method ?? "POST", body: request.body })
    },
    onSuccess: () => Promise.all([...invalidate, ...AGGREGATES].map((queryKey) => client.invalidateQueries({ queryKey }))),
  })
}

export type Me = { user: { id: string; email: string; display_name: string; roles: string[]; is_owner?: boolean } }

export function useMe() {
  return useAdminQuery<Me>(keys.me, "/api/auth/me")
}

const STAFF_READ = ["SUPER_ADMIN", "EVENT_ADMIN", "REGISTRATION_ADMIN", "EVALUATION_ADMIN", "SUPPORT_ADMIN", "VIEWER"]

export const can = {
  read: (roles: string[]) => roles.some((role) => STAFF_READ.includes(role)),
  review: (roles: string[]) => roles.some((role) => ["SUPER_ADMIN", "EVENT_ADMIN", "REGISTRATION_ADMIN"].includes(role)),
  assign: (roles: string[]) => roles.some((role) => ["SUPER_ADMIN", "EVENT_ADMIN", "EVALUATION_ADMIN"].includes(role)),
  eventControl: (roles: string[]) => roles.some((role) => ["SUPER_ADMIN", "EVENT_ADMIN"].includes(role)),
  support: (roles: string[]) => roles.some((role) => ["SUPER_ADMIN", "EVENT_ADMIN", "SUPPORT_ADMIN"].includes(role)),
  money: (roles: string[]) => roles.includes("SUPER_ADMIN"),
  superAdmin: (roles: string[]) => roles.includes("SUPER_ADMIN"),
  judge: (roles: string[]) => roles.includes("JUDGE"),
  checkin: (roles: string[]) => roles.some((role) => ["SUPER_ADMIN", "EVENT_ADMIN", "REGISTRATION_ADMIN", "SUPPORT_ADMIN"].includes(role)),
}
