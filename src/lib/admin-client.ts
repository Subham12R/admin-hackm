import { z } from "zod"

import { ApiError } from "@/lib/api"

export const registrationCategories = [
  "Adamas ACM",
  "Adamas only",
  "Outer college",
  "Outer + ACM",
] as const

const categorySchema = z.enum(registrationCategories)
export const finalsStatuses = ["PENDING", "ACCEPTED", "DECLINED"] as const
export const finalsSchema = z.object({
  status: z.enum(finalsStatuses),
  decided_at: z.string().nullable(),
  decided_by: z.string().nullable(),
  // Optional so an older backend still parses.
  notified_status: z.enum(finalsStatuses).nullable().optional(),
  rsvp_status: z.enum(["PENDING", "CONFIRMED", "DECLINED"]).optional(),
})
const reviewSchema = z.object({
  status: z.enum(["PENDING", "VERIFIED", "DECLINED"]),
  reviewed_at: z.string().nullable(),
  reviewed_by: z.string().nullable(),
})
const registrationRowSchema = z.object({
  registration_id: z.string(),
  registered_at: z.string(),
  team_name: z.string(),
  leader: z.string(),
  email: z.string(),
  phone: z.string(),
  college: z.string(),
  members: z.number().int().nonnegative(),
  acm: z.enum(["Yes", "No"]),
  acm_members: z.number().int().nonnegative(),
  category: categorySchema,
  registration_status: z.string(),
  fee_waived: z.boolean().default(false),
  payment_status: z.string(),
  payment_needs_review: z.boolean().default(false),
  adjustment_status: z.string().default("NONE"),
  acm_pending: z.number().int().nonnegative().default(0),
  amount_minor: z.number().int().nonnegative(),
  refunded_amount_minor: z.number().int().nonnegative().default(0),
})
const dailyCountSchema = z.object({
  date: z.string(),
  adamas: z.number().int().nonnegative(),
  other: z.number().int().nonnegative(),
})
const evaluatorSchema = z.object({
  email: z.string(),
  display_name: z.string(),
})
const logSchema = z.object({
  id: z.string().optional(),
  timestamp: z.string(),
  actor: z.string(),
  action: z.string(),
  resource: z.string(),
  details: z.string(),
})

export const overviewSchema = z.object({
  viewer_name: z.string(),
  metrics: z.object({
    registrations: z.number().int().nonnegative(),
    paid_teams: z.number().int().nonnegative().default(0),
    monetary_amount_minor: z.number().int(),
    submissions: z.number().int().nonnegative(),
    total_users: z.number().int().nonnegative(),
    payments_needing_review: z.number().int().nonnegative().default(0),
  }),
  registration_series: z.array(
    z.object({ date: z.string(), registrations: z.number().int().nonnegative() })
  ),
  registration_split: z.array(
    z.object({ category: categorySchema, registrations: z.number().int().nonnegative() })
  ),
  recent_registrations: z.array(registrationRowSchema),
  recent_logs: z.array(logSchema),
})

export const registrationsPageSchema = z.object({
  items: z.array(registrationRowSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  daily_counts: z.array(dailyCountSchema),
})

export const teamsPageSchema = z.object({
  items: z.array(
    z.object({
      registration_id: z.string(),
      team_id: z.string(),
      registered_at: z.string(),
      team_name: z.string(),
      leader: z.string(),
      email: z.string(),
      phone: z.string(),
      college: z.string(),
      fee_waived: z.boolean().default(false),
      members: z.array(
        z.object({
          id: z.string(),
          acm_review_status: z.string(),
          name: z.string(),
          email: z.string(),
          phone: z.string(),
          college: z.string(),
          role: z.string(),
          acm: z.enum(["Yes", "No"]),
          acm_id: z.string().nullable(),
        })
      ),
      member_count: z.number().int().nonnegative(),
      acm: z.enum(["Yes", "No"]),
      acm_members: z.number().int().nonnegative(),
      category: categorySchema,
      status: z.string(),
      adjustment: z.object({ status: z.string(), amount_minor: z.number().int() }),
      review: reviewSchema,
      finals: finalsSchema,
      // The team's locked problem statement in each event that has several.
      tracks: z.array(z.object({
        stage_id: z.string(), stage: z.string(), track: z.object({ id: z.string(), title: z.string() }).nullable(), locked_at: z.string().nullable(),
      })).default([]),
    })
  ),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  daily_counts: z.array(dailyCountSchema),
})

const judgeSlotSchema = evaluatorSchema.extend({
  assignment_id: z.string(),
  scorecard_status: z.string(),
})

const trackRefSchema = z.object({ id: z.string(), title: z.string() })
const awardSchema = z.object({ id: z.string(), placement: z.number().int(), label: z.string(), track: trackRefSchema.nullable() })
export type Award = z.infer<typeof awardSchema>

export const submissionsSchema = z.object({
  submissions: z.array(
    z.object({
      team_id: z.string(),
      registration_id: z.string(),
      team_name: z.string(),
      anonymous_code: z.string().nullable(),
      project_name: z.string(),
      description: z.string(),
      links: z.array(z.object({ label: z.string(), href: z.string() })),
      start_time: z.string(),
      updated_at: z.string().nullable(),
      end_time: z.string().nullable(),
      status: z.enum(["Draft", "Submitted", "Evaluated"]),
      submission_status: z.string(),
      evaluations: z.number().int().nonnegative(),
      assigned_to: evaluatorSchema.nullable(),
      judges: z.array(judgeSlotSchema),
      can_assign: z.boolean(),
      submission_id: z.string().nullable().default(null),
      track: trackRefSchema.nullable().default(null),
      track_locked_at: z.string().nullable().default(null),
      timer: z.object({
        limit_minutes: z.number(), started_at: z.string().nullable(), deadline: z.string().nullable(),
        state: z.enum(["UNTIMED", "NOT_STARTED", "RUNNING", "EXPIRED"]),
      }).nullable().default(null),
      awards: z.array(awardSchema).default([]),
    })
  ),
  round: z.object({ id: z.string(), name: z.string(), status: z.string() }).nullable(),
  stage: z.object({ id: z.string(), name: z.string(), eligibility: z.string() }).nullable().default(null),
  tracks: z.array(trackRefSchema).default([]),
})

export const evaluatorsSchema = z.object({
  evaluators: z.array(evaluatorSchema.extend({ assignments: z.number().int().default(0) })),
})

export const evaluationsSchema = z.object({
  evaluations: z.array(
    z.object({
      scorecard_id: z.string(),
      team_id: z.string(),
      team_name: z.string(),
      registration_id: z.string(),
      anonymous_code: z.string().nullable().optional(),
      round: z.string(),
      round_id: z.string(),
      scores: z.record(z.string(), z.number()),
      criteria: z.array(z.object({ key: z.string(), label: z.string(), max_score: z.number() })),
      total: z.number(),
      comments: z.string(),
      evaluated_at: z.string().nullable(),
      evaluated_by: z.string(),
    })
  ),
})

export const logsSchema = z.object({ logs: z.array(logSchema) })

export class AdminDataError extends ApiError {
  constructor(status: number) {
    super(status, "admin-data-unavailable")
  }
}

export async function getAdminJson<T>(
  url: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new AdminDataError(response.status)

  try {
    return schema.parse(await response.json())
  } catch {
    throw new AdminDataError(502)
  }
}

export type RegistrationCategory = (typeof registrationCategories)[number]
type RegistrationRow = z.infer<typeof registrationRowSchema>
type Review = z.infer<typeof reviewSchema>
export type Evaluator = z.infer<typeof evaluatorSchema>

export type Registration = {
  registrationId: string
  registeredAt: string
  teamName: string
  leader: string
  email: string
  phone: string
  college: string
  members: number
  acm: "Yes" | "No"
  acmMembers: number
  acmPending: number
  category: RegistrationCategory
  registrationStatus: string
  /** Registered without paying: free entry or a free invite. */
  feeWaived: boolean
  paymentStatus: "Success" | "Pending" | "Failed"
  paymentNeedsReview: boolean
  adjustmentStatus: string
  amountMinor: number
  refundedAmountMinor: number
}

export type Team = Omit<Registration, "members" | "paymentStatus" | "amountMinor" | "registrationStatus" | "paymentNeedsReview" | "adjustmentStatus" | "acmPending" | "refundedAmountMinor"> & {
  teamId: string
  status: string
  members: TeamMember[]
  memberCount: number
  adjustment: { status: string; amountMinor: number }
  review: TeamReview
  finals: TeamFinals
  tracks: TeamTrack[]
}

export type TeamTrack = { stageId: string; stage: string; track: { id: string; title: string } | null; lockedAt: string | null }

export type TeamFinals = {
  status: (typeof finalsStatuses)[number]
  decidedAt: string | null
  decidedBy: string | null
  /** The decision the team was last emailed; differs from `status` until the next release. */
  notifiedStatus: (typeof finalsStatuses)[number] | null
  rsvpStatus: "PENDING" | "CONFIRMED" | "DECLINED"
}

export type TeamMember = {
  id: string
  name: string
  email: string
  phone: string
  college: string
  role: string
  acm: "Yes" | "No"
  acmId: string | null
  acmReviewStatus: string
}

export type TeamReview = {
  status: "PENDING" | "VERIFIED" | "DECLINED"
  reviewedAt: string | null
  reviewedBy: string | null
}

export type JudgeSlot = Evaluator & { assignmentId: string; scorecardStatus: string }

export type Submission = {
  teamId: string
  registrationId: string
  teamName: string
  anonymousCode: string | null
  projectName: string
  description: string
  links: { label: string; href: string }[]
  startTime: string
  updatedAt: string | null
  endTime: string | null
  status: "Draft" | "Submitted" | "Evaluated"
  submissionStatus: string
  evaluations: number
  assignedTo: Evaluator | null
  judges: JudgeSlot[]
  canAssign: boolean
  submissionId: string | null
  track: { id: string; title: string } | null
  trackLockedAt: string | null
  timer: { limit_minutes: number; started_at: string | null; deadline: string | null; state: "UNTIMED" | "NOT_STARTED" | "RUNNING" | "EXPIRED" } | null
  awards: Award[]
}

export type Evaluation = {
  scorecardId: string
  teamId: string
  teamName: string
  registrationId: string
  anonymousCode: string | null
  round: string
  roundId: string
  scores: Record<string, number>
  criteria: { key: string; label: string; maxScore: number }[]
  total: number
  comments: string
  evaluatedAt: string | null
  evaluatedBy: string
}

export type AuditLog = {
  id?: string
  timestamp: string
  actor: string
  action: string
  resource: string
  details: string
}

export type Overview = {
  viewerName: string
  metrics: {
    registrations: number
    paidTeams: number
    monetaryAmountMinor: number
    submissions: number
    totalUsers: number
    paymentsNeedingReview: number
  }
  registrationSeries: { date: string; registrations: number }[]
  registrationSplit: { category: RegistrationCategory; registrations: number }[]
  recentRegistrations: Registration[]
  recentLogs: AuditLog[]
}

export function toOverview(data: z.infer<typeof overviewSchema>): Overview {
  return {
    viewerName: data.viewer_name,
    metrics: {
      registrations: data.metrics.registrations,
      paidTeams: data.metrics.paid_teams,
      monetaryAmountMinor: data.metrics.monetary_amount_minor,
      submissions: data.metrics.submissions,
      totalUsers: data.metrics.total_users,
      paymentsNeedingReview: data.metrics.payments_needing_review,
    },
    registrationSeries: data.registration_series,
    registrationSplit: data.registration_split,
    recentRegistrations: data.recent_registrations.map(toRegistration),
    recentLogs: data.recent_logs.map(toAuditLog),
  }
}

export function toRegistrationsPage(data: z.infer<typeof registrationsPageSchema>) {
  return {
    registrations: data.items.map(toRegistration),
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
    dailyCounts: data.daily_counts,
  }
}

export function toTeamsPage(data: z.infer<typeof teamsPageSchema>) {
  return {
    teams: data.items.map((team): Team => ({
      registrationId: team.registration_id,
      teamId: team.team_id,
      registeredAt: team.registered_at,
      teamName: team.team_name,
      leader: team.leader,
      email: team.email,
      phone: team.phone,
      college: team.college,
      status: team.status,
      feeWaived: team.fee_waived,
      members: team.members.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        college: member.college,
        role: member.role,
        acm: member.acm,
        acmId: member.acm_id,
        acmReviewStatus: member.acm_review_status,
      })),
      memberCount: team.member_count,
      acm: team.acm,
      acmMembers: team.acm_members,
      category: team.category,
      adjustment: { status: team.adjustment.status, amountMinor: team.adjustment.amount_minor },
      review: toReview(team.review),
      finals: toFinals(team.finals),
      tracks: team.tracks.map((item) => ({ stageId: item.stage_id, stage: item.stage, track: item.track, lockedAt: item.locked_at })),
    })),
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
    dailyCounts: data.daily_counts,
  }
}

export function toSubmissions(data: z.infer<typeof submissionsSchema>): Submission[] {
  return data.submissions.map((submission) => ({
    teamId: submission.team_id,
    registrationId: submission.registration_id,
    teamName: submission.team_name,
    anonymousCode: submission.anonymous_code,
    projectName: submission.project_name,
    description: submission.description,
    links: submission.links,
    startTime: submission.start_time,
    updatedAt: submission.updated_at,
    endTime: submission.end_time,
    status: submission.status,
    submissionStatus: submission.submission_status,
    evaluations: submission.evaluations,
    assignedTo: submission.assigned_to,
    judges: submission.judges.map((judge) => ({
      email: judge.email,
      display_name: judge.display_name,
      assignmentId: judge.assignment_id,
      scorecardStatus: judge.scorecard_status,
    })),
    canAssign: submission.can_assign,
    submissionId: submission.submission_id,
    track: submission.track,
    trackLockedAt: submission.track_locked_at,
    timer: submission.timer,
    awards: submission.awards,
  }))
}

export function toEvaluations(data: z.infer<typeof evaluationsSchema>): Evaluation[] {
  return data.evaluations.map((evaluation) => ({
    scorecardId: evaluation.scorecard_id,
    teamId: evaluation.team_id,
    teamName: evaluation.team_name,
    registrationId: evaluation.registration_id,
    anonymousCode: evaluation.anonymous_code ?? null,
    round: evaluation.round,
    roundId: evaluation.round_id,
    scores: evaluation.scores,
    criteria: evaluation.criteria.map((criterion) => ({ key: criterion.key, label: criterion.label, maxScore: criterion.max_score })),
    total: evaluation.total,
    comments: evaluation.comments,
    evaluatedAt: evaluation.evaluated_at,
    evaluatedBy: evaluation.evaluated_by,
  }))
}

export function toAuditLogs(data: z.infer<typeof logsSchema>): AuditLog[] {
  return data.logs.map(toAuditLog)
}

export function toReview(data: Review): TeamReview {
  return {
    status: data.status,
    reviewedAt: data.reviewed_at,
    reviewedBy: data.reviewed_by,
  }
}

function toRegistration(row: RegistrationRow): Registration {
  return {
    registrationId: row.registration_id,
    registeredAt: row.registered_at,
    teamName: row.team_name,
    leader: row.leader,
    email: row.email,
    phone: row.phone,
    college: row.college,
    members: row.members,
    acm: row.acm,
    acmMembers: row.acm_members,
    acmPending: row.acm_pending,
    category: row.category,
    registrationStatus: row.registration_status,
    feeWaived: row.fee_waived,
    paymentStatus: paymentStatus(row.payment_status),
    paymentNeedsReview: row.payment_needs_review,
    adjustmentStatus: row.adjustment_status,
    amountMinor: row.amount_minor,
    refundedAmountMinor: row.refunded_amount_minor,
  }
}

function toAuditLog(log: z.infer<typeof logSchema>): AuditLog {
  return {
    id: log.id,
    timestamp: log.timestamp,
    actor: log.actor,
    action: log.action,
    resource: log.resource,
    details: log.details,
  }
}

function paymentStatus(status: string): Registration["paymentStatus"] {
  if (status === "CAPTURED") return "Success"
  if (status === "FAILED" || status === "CANCELLED") return "Failed"
  return "Pending"
}

/** Fetch + validate through the same-origin BFF; used as a TanStack Query function. */
export function adminQuery<T>(url: string, schema: z.ZodType<T>) {
  return ({ signal }: { signal: AbortSignal }) => getAdminJson(url, schema, signal)
}

export function toFinals(data: z.infer<typeof finalsSchema>): TeamFinals {
  return {
    status: data.status, decidedAt: data.decided_at, decidedBy: data.decided_by,
    notifiedStatus: data.notified_status ?? null, rsvpStatus: data.rsvp_status ?? "PENDING",
  }
}
