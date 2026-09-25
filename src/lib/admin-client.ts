import { z } from "zod"

export const registrationCategories = [
  "Adamas ACM",
  "Adamas only",
  "Outer college",
  "Outer + ACM",
] as const

const categorySchema = z.enum(registrationCategories)
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
  payment_status: z.string(),
  amount_minor: z.number().int().nonnegative(),
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
    monetary_amount_minor: z.number().int().nonnegative(),
    submissions: z.number().int().nonnegative(),
    total_users: z.number().int().nonnegative(),
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
      members: z.array(
        z.object({
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
      review: reviewSchema,
    })
  ),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  daily_counts: z.array(dailyCountSchema),
})

export const submissionsSchema = z.object({
  submissions: z.array(
    z.object({
      team_id: z.string(),
      registration_id: z.string(),
      team_name: z.string(),
      project_name: z.string(),
      links: z.array(z.object({ label: z.string(), href: z.string() })),
      start_time: z.string(),
      end_time: z.string().nullable(),
      status: z.enum(["Draft", "Submitted", "Evaluated"]),
      assigned_to: evaluatorSchema.nullable(),
      can_assign: z.boolean(),
    })
  ),
})

export const evaluatorsSchema = z.object({ evaluators: z.array(evaluatorSchema) })

export const assignmentSchema = z.object({ assigned_to: evaluatorSchema })

export const evaluationsSchema = z.object({
  evaluations: z.array(
    z.object({
      team_id: z.string(),
      registration_id: z.string(),
      round: z.string(),
      scores: z.object({
        innovation: z.number().int(),
        technical: z.number().int(),
        problem_solving: z.number().int(),
        ui_ux: z.number().int(),
        completeness: z.number().int(),
      }),
      evaluated_at: z.string(),
      evaluated_by: z.string(),
    })
  ),
})

export const logsSchema = z.object({ logs: z.array(logSchema) })

export const reviewResponseSchema = z.object({ review: reviewSchema })

export class AdminDataError extends Error {
  constructor(readonly status: number) {
    super("admin-data-unavailable")
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
  category: RegistrationCategory
  paymentStatus: "Success" | "Pending" | "Failed"
  amountMinor: number
}

export type Team = Omit<Registration, "members" | "paymentStatus" | "amountMinor"> & {
  teamId: string
  members: TeamMember[]
  memberCount: number
  review: TeamReview
}

export type TeamMember = {
  name: string
  email: string
  phone: string
  college: string
  role: string
  acm: "Yes" | "No"
  acmId: string | null
}

export type TeamReview = {
  status: "PENDING" | "VERIFIED" | "DECLINED"
  reviewedAt: string | null
  reviewedBy: string | null
}

export type Submission = {
  teamId: string
  registrationId: string
  teamName: string
  projectName: string
  links: { label: string; href: string }[]
  startTime: string
  endTime: string | null
  status: "Draft" | "Submitted" | "Evaluated"
  assignedTo: Evaluator | null
  canAssign: boolean
}

export type Evaluation = {
  teamId: string
  registrationId: string
  round: string
  scores: {
    innovation: number
    technical: number
    problemSolving: number
    uiUx: number
    completeness: number
  }
  evaluatedAt: string
  evaluatedBy: string
}

export type AuditLog = {
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
    monetaryAmountMinor: number
    submissions: number
    totalUsers: number
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
      monetaryAmountMinor: data.metrics.monetary_amount_minor,
      submissions: data.metrics.submissions,
      totalUsers: data.metrics.total_users,
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
    teams: data.items.map((team) => ({
      registrationId: team.registration_id,
      teamId: team.team_id,
      registeredAt: team.registered_at,
      teamName: team.team_name,
      leader: team.leader,
      email: team.email,
      phone: team.phone,
      college: team.college,
      members: team.members.map((member) => ({
        name: member.name,
        email: member.email,
        phone: member.phone,
        college: member.college,
        role: member.role,
        acm: member.acm,
        acmId: member.acm_id,
      })),
      memberCount: team.member_count,
      acm: team.acm,
      acmMembers: team.acm_members,
      category: team.category,
      review: toReview(team.review),
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
    projectName: submission.project_name,
    links: submission.links,
    startTime: submission.start_time,
    endTime: submission.end_time,
    status: submission.status,
    assignedTo: submission.assigned_to,
    canAssign: submission.can_assign,
  }))
}

export function toEvaluations(data: z.infer<typeof evaluationsSchema>): Evaluation[] {
  return data.evaluations.map((evaluation) => ({
    teamId: evaluation.team_id,
    registrationId: evaluation.registration_id,
    round: evaluation.round,
    scores: {
      innovation: evaluation.scores.innovation,
      technical: evaluation.scores.technical,
      problemSolving: evaluation.scores.problem_solving,
      uiUx: evaluation.scores.ui_ux,
      completeness: evaluation.scores.completeness,
    },
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
    category: row.category,
    paymentStatus: paymentStatus(row.payment_status),
    amountMinor: row.amount_minor,
  }
}

function toAuditLog(log: z.infer<typeof logSchema>): AuditLog {
  return {
    timestamp: log.timestamp,
    actor: log.actor,
    action: log.action,
    resource: log.resource,
    details: log.details,
  }
}

function paymentStatus(status: string): Registration["paymentStatus"] {
  if (status === "CAPTURED") return "Success"
  if (status === "FAILED") return "Failed"
  return "Pending"
}
