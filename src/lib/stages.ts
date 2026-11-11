import { keys, useAdminQuery } from "@/lib/queries"

/** Protected resources open inside the participant dashboard; teams never get the link. Google files only. */
export type Resource = { label: string; url: string; protected?: boolean }
export type Track = {
  id: string
  title: string
  summary: string
  body: string
  resources: Resource[]
  position: number
  version: number
  updated_at: string | null
}
export type Stage = {
  id: string
  name: string
  description: string
  position: number
  eligibility: "ALL_PAID" | "FINALISTS"
  published: boolean
  submission_window: { opens_at: string | null; closes_at: string | null; state: "OPEN" | "NOT_OPEN" | "CLOSED" }
  statements: { release_at: string | null; released: boolean }
  // Per-team time limit: each team gets this long from when it starts, never past submissions closing.
  time_limit_minutes?: number | null
  started?: number
  // REVEAL: statements unlock at the reveal time. SELECT: all are visible from the start and the team leader picks one.
  statement_mode?: StatementMode
  // REVEAL: the clock follows the reveal (each timed team starts its own). OPEN: it starts for every team when submissions open.
  timer_start?: TimerStart
  tracks: Track[]
  updated_at: string | null
  completed_at: string | null
  teams: number
  drafts: number
  submitted: number
  awards: number
}

export type StatementMode = "REVEAL" | "SELECT"
export type TimerStart = "REVEAL" | "OPEN"

export const STATEMENT_MODES: Record<StatementMode, string> = {
  REVEAL: "Reveal at a set time",
  SELECT: "Selectable: all visible, leader picks one",
}

export const TIMER_STARTS: Record<TimerStart, string> = {
  REVEAL: "With the reveal (team starts its clock)",
  OPEN: "When submissions open, for every team",
}

export const ELIGIBILITY: Record<Stage["eligibility"], string> = {
  ALL_PAID: "All paid teams",
  FINALISTS: "Teams accepted for the finals",
}

export const PLACEMENTS = [
  [1, "Winner"],
  [2, "1st runner-up"],
  [3, "2nd runner-up"],
  [4, "4th place"],
  [5, "5th place"],
] as const

/** Every event (stage) of the hackathon, in order. */
export function useStages() {
  return useAdminQuery<{ items: Stage[] }>(keys.stages, "/api/admin/stages", { refetchInterval: 60_000 })
}
