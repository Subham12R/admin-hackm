"use client"

import { useEffect, useState } from "react"

import { ExternalLink } from "lucide-react"
import { useRouter } from "next/navigation"

import { RichButton } from "@/components/rich-button"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AdminDataError,
  assignmentSchema,
  evaluatorsSchema,
  getAdminJson,
  submissionsSchema,
  toSubmissions,
  type Evaluator,
  type Submission,
} from "@/lib/admin-client"

const statusClassName: Record<Submission["status"], string> = {
  Draft: "bg-zinc-100 text-zinc-700",
  Submitted: "bg-amber-50 text-amber-700",
  Evaluated: "bg-emerald-50 text-emerald-700",
}

function formatDateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—"
}

export default function SubmissionsPage() {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [evaluators, setEvaluators] = useState<Evaluator[]>([])
  const [loadError, setLoadError] = useState("")
  const [assignError, setAssignError] = useState("")
  const [assigningTeamId, setAssigningTeamId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      getAdminJson("/api/admin/submissions", submissionsSchema, controller.signal),
      getAdminJson("/api/admin/evaluators", evaluatorsSchema, controller.signal),
    ])
      .then(([submissionResponse, evaluatorResponse]) => {
        setLoadError("")
        setSubmissions(toSubmissions(submissionResponse))
        setEvaluators(evaluatorResponse.evaluators)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof AdminDataError && error.status === 401) {
          router.replace("/login")
          return
        }
        setLoadError("Submissions could not be loaded.")
      })
    return () => controller.abort()
  }, [router])

  async function assignEvaluator(submission: Submission, evaluator: Evaluator) {
    setAssigningTeamId(submission.teamId)
    setAssignError("")
    try {
      const response = await fetch(`/api/admin/submissions/${submission.registrationId}/assign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignee_email: evaluator.email }),
      })
      if (response.status === 401) {
        router.replace("/login")
        return
      }
      if (!response.ok) throw new Error("assignment unavailable")
      const { assigned_to } = assignmentSchema.parse(await response.json())
      setSubmissions((current) => current.map((item) =>
        item.teamId === submission.teamId ? { ...item, assignedTo: assigned_to } : item
      ))
    } catch {
      setAssignError("Evaluator assignment could not be saved.")
    } finally {
      setAssigningTeamId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Submissions</h1>
        <p className="text-sm tracking-tighter text-muted-foreground">
          Review project submissions from participant dashboards.
        </p>
      </div>

      <section className="min-w-0 rounded-2xl bg-zinc-100 p-1">
        <div className="min-w-0 overflow-hidden rounded-xl bg-white p-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight">Project submissions</h2>
            {loadError || assignError ? <p role="alert" className="text-sm text-red-600">{loadError || assignError}</p> : null}
            <p className="text-sm tracking-tighter text-muted-foreground">
              {submissions.length} submission{submissions.length === 1 ? "" : "s"}
            </p>
          </div>

          <Table className="min-w-[1120px]">
            <TableCaption className="sr-only">
              Project submissions with links, project timing, and review status.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="h-10 normal-case tracking-tighter">Team</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Project name</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Submission links</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Start time</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">End time</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Status</TableHead>
                <TableHead className="h-10 text-right normal-case tracking-tighter">Assign</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.length ? submissions.map((submission) => (
                <TableRow key={submission.teamId}>
                  <TableCell>{submission.teamName}</TableCell>
                  <TableCell>{submission.projectName}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {submission.links.map((link) => (
                        <a
                          key={link.label}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs tracking-tighter text-zinc-700 hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                        >
                          {link.label}
                          <ExternalLink className="size-3" />
                        </a>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{formatDateTime(submission.startTime)}</TableCell>
                  <TableCell>{formatDateTime(submission.endTime)}</TableCell>
                  <TableCell>
                    <span className={`rounded-md px-2 py-1 text-xs tracking-tighter ${statusClassName[submission.status]}`}>
                      {submission.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <RichButton
                            type="button"
                            color="zinc"
                            size="sm"
                            disabled={!submission.canAssign || assigningTeamId === submission.teamId}
                            className="font-pixel-square tracking-tighter"
                          >
                            {submission.assignedTo?.display_name ?? "Assign"}
                          </RichButton>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-48 rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-900 shadow-xl">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="font-pixel-square normal-case tracking-tighter">
                            Assign evaluator
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {evaluators.length ? evaluators.map((evaluator) => (
                            <DropdownMenuItem
                              key={evaluator.email}
                              onClick={() => void assignEvaluator(submission, evaluator)}
                              className="font-pixel-square normal-case tracking-tighter"
                            >
                              {evaluator.display_name}
                            </DropdownMenuItem>
                          )) : <DropdownMenuItem disabled>No evaluators available</DropdownMenuItem>}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {loadError || "Loading submissions..."}
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
