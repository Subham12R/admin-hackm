"use client"

import { useMemo, useState } from "react"

import { RichButton } from "@/components/rich-button"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const metrics = [
  { key: "innovation", label: "Innovation" },
  { key: "technical", label: "Technical implementation" },
  { key: "problemSolving", label: "Problem solving" },
  { key: "uiUx", label: "UI / UX" },
  { key: "completeness", label: "Completeness" },
] as const

type Metric = (typeof metrics)[number]["key"]

type Evaluation = {
  teamId: string
  round: string
  scores: Record<Metric, number>
  evaluatedAt: string
  evaluatedBy: string
}

const sortOptions = [
  { value: "newest", label: "Newest evaluation" },
  { value: "oldest", label: "Oldest evaluation" },
  { value: "highestTotal", label: "Highest total" },
  { value: "lowestTotal", label: "Lowest total" },
  { value: "teamId", label: "Team ID" },
] as const

type SortOption = (typeof sortOptions)[number]["value"]

const rounds = ["Round 1", "Round 2"] as const
const evaluators = ["Judge Ananya", "Judge Rohan"] as const

const evaluations = [
  {
    teamId: "HM-K8Q2P",
    round: "Round 1",
    scores: { innovation: 9, technical: 8, problemSolving: 9, uiUx: 8, completeness: 8 },
    evaluatedAt: "2026-11-07T15:42:00+05:30",
    evaluatedBy: "Judge Ananya",
  },
  {
    teamId: "HM-M4X7D",
    round: "Round 1",
    scores: { innovation: 8, technical: 9, problemSolving: 8, uiUx: 7, completeness: 9 },
    evaluatedAt: "2026-11-07T16:18:00+05:30",
    evaluatedBy: "Judge Rohan",
  },
  {
    teamId: "HM-T9V3L",
    round: "Round 1",
    scores: { innovation: 7, technical: 8, problemSolving: 8, uiUx: 9, completeness: 7 },
    evaluatedAt: "2026-11-07T16:31:00+05:30",
    evaluatedBy: "Judge Ananya",
  },
  {
    teamId: "HM-C6N1R",
    round: "Round 2",
    scores: { innovation: 9, technical: 8, problemSolving: 9, uiUx: 9, completeness: 8 },
    evaluatedAt: "2026-11-08T10:12:00+05:30",
    evaluatedBy: "Judge Rohan",
  },
  {
    teamId: "HM-B2F5W",
    round: "Round 2",
    scores: { innovation: 8, technical: 7, problemSolving: 8, uiUx: 8, completeness: 8 },
    evaluatedAt: "2026-11-08T10:48:00+05:30",
    evaluatedBy: "Judge Ananya",
  },
] satisfies readonly Evaluation[]

function totalScore(evaluation: Evaluation) {
  return metrics.reduce((total, metric) => total + evaluation.scores[metric.key], 0)
}

function formatEvaluationTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp))
}

export default function EvaluationsPage() {
  const [teamIdQuery, setTeamIdQuery] = useState("")
  const [round, setRound] = useState<(typeof rounds)[number] | "all">("all")
  const [evaluator, setEvaluator] = useState<(typeof evaluators)[number] | "all">("all")
  const [sort, setSort] = useState<SortOption>("newest")

  const filteredEvaluations = useMemo(
    () =>
      evaluations.filter(
        (evaluation) =>
          evaluation.teamId.toLowerCase().includes(teamIdQuery.trim().toLowerCase()) &&
          (round === "all" || evaluation.round === round) &&
          (evaluator === "all" || evaluation.evaluatedBy === evaluator)
      ),
    [evaluator, round, teamIdQuery]
  )
  const sortedEvaluations = useMemo(() => {
    return [...filteredEvaluations].sort((a, b) => {
      if (sort === "highestTotal") return totalScore(b) - totalScore(a)
      if (sort === "lowestTotal") return totalScore(a) - totalScore(b)
      if (sort === "teamId") return a.teamId.localeCompare(b.teamId)

      const timestampDifference = new Date(a.evaluatedAt).getTime() - new Date(b.evaluatedAt).getTime()
      return sort === "oldest" ? timestampDifference : -timestampDifference
    })
  }, [filteredEvaluations, sort])
  const hasFilters = Boolean(teamIdQuery) || round !== "all" || evaluator !== "all"

  function clearFilters() {
    setTeamIdQuery("")
    setRound("all")
    setEvaluator("all")
  }

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Evaluations</h1>
        <p className="text-sm tracking-tighter text-muted-foreground">
          Score anonymous submissions without exposing team names.
        </p>
      </div>

      <section className="min-w-0 rounded-2xl bg-zinc-100 p-1">
        <div className="min-w-0 overflow-hidden rounded-xl bg-white p-4">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Evaluation score sheet</h2>
              <p aria-live="polite" className="text-sm tracking-tighter text-muted-foreground">
                {filteredEvaluations.length} evaluation{filteredEvaluations.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
                Team ID
                <input
                  value={teamIdQuery}
                  onChange={(event) => setTeamIdQuery(event.target.value)}
                  placeholder="Search ID"
                  className="h-8 w-32 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
                Round
                <select
                  value={round}
                  onChange={(event) => setRound(event.target.value as typeof round)}
                  className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  <option value="all">All rounds</option>
                  {rounds.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
                Evaluator
                <select
                  value={evaluator}
                  onChange={(event) => setEvaluator(event.target.value as typeof evaluator)}
                  className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  <option value="all">All evaluators</option>
                  {evaluators.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
                Sort
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortOption)}
                  className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <RichButton
                type="button"
                color="zinc"
                size="sm"
                disabled={!hasFilters}
                onClick={clearFilters}
                className="font-pixel-square tracking-tighter"
              >
                Clear filters
              </RichButton>
            </div>
          </div>

          <Table className="min-w-[1400px]">
            <TableCaption className="sr-only">
              Anonymous team evaluations with round, five rubric scores, total, evaluation time, and evaluator.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="h-10 normal-case tracking-tighter">Team ID</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Round</TableHead>
                {metrics.map((metric) => (
                  <TableHead
                    key={metric.key}
                    className="h-10 text-center normal-case tracking-tighter"
                  >
                    {metric.label}
                  </TableHead>
                ))}
                <TableHead className="h-10 text-center normal-case tracking-tighter">Total</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Evaluated at</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Evaluated by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEvaluations.length ? (
                sortedEvaluations.map((evaluation) => (
                  <TableRow key={`${evaluation.teamId}-${evaluation.round}`}>
                    <TableCell className="font-medium">{evaluation.teamId}</TableCell>
                    <TableCell>{evaluation.round}</TableCell>
                    {metrics.map((metric) => (
                      <TableCell key={metric.key} className="text-center tabular-nums">
                        {evaluation.scores[metric.key]}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-medium tabular-nums">
                      {totalScore(evaluation)}
                    </TableCell>
                    <TableCell>{formatEvaluationTime(evaluation.evaluatedAt)}</TableCell>
                    <TableCell>{evaluation.evaluatedBy}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={metrics.length + 5} className="h-24 text-center text-muted-foreground">
                    No evaluations match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
