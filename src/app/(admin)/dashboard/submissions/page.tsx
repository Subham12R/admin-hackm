"use client"

import { Fragment, useState } from "react"

import { useQuery } from "@tanstack/react-query"
import { ExternalLink } from "lucide-react"

import { Badge, Button, ConfirmButton, Notice, PageHeader, Panel, Select, StatusBadge } from "@/components/admin/kit"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { adminQuery, evaluatorsSchema, submissionsSchema, toSubmissions, type Submission } from "@/lib/admin-client"
import { dateTime, errorMessage } from "@/lib/api"
import { can, keys, useAdminMutation, useMe } from "@/lib/queries"

const statusTone = { Draft: "zinc", Submitted: "amber", Evaluated: "green" } as const

export default function SubmissionsPage() {
  const me = useMe()
  const roles = me.data?.user.roles ?? []
  const canAssign = can.assign(roles)
  const submissions = useQuery({
    queryKey: keys.submissions,
    queryFn: adminQuery("/api/admin/submissions", submissionsSchema),
    refetchInterval: 30_000,
  })
  // Only assigners may list judges; asking otherwise is a 403 that used to break this page.
  const evaluators = useQuery({
    queryKey: keys.evaluators,
    queryFn: adminQuery("/api/admin/evaluators", evaluatorsSchema),
    enabled: canAssign,
  })
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | Submission["status"]>("all")
  const assign = useAdminMutation<{ registrationId: string; email: string }>(
    ({ registrationId, email }) => ({ path: `/api/admin/submissions/${registrationId}/assign`, body: { assignee_email: email } }),
    [["submissions"], ["evaluators"], ["board"]]
  )
  const reopen = useAdminMutation<string>((registrationId) => ({ path: `/api/admin/submissions/${registrationId}/reopen` }), [["submissions"]])

  const rows = submissions.data ? toSubmissions(submissions.data) : []
  const visible = filter === "all" ? rows : rows.filter((row) => row.status === filter)
  const round = submissions.data?.round

  function run(promise: Promise<unknown>, success: string) {
    setMessage(null)
    promise.then(() => setMessage({ tone: "green", text: success })).catch((error) => setMessage({ tone: "red", text: errorMessage(error) }))
  }

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader
        title="Submissions"
        description={round ? `Project links from paid teams. New judges are assigned to ${round.name} (${round.status.toLowerCase()}).` : "Project links from paid teams. Create a round under Rounds & Results to start judging."}
      />
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <Panel
        title="All submissions"
        description={`${rows.filter((row) => row.submissionStatus === "SUBMITTED").length} final, ${rows.filter((row) => row.submissionStatus === "DRAFT").length} drafts, ${rows.filter((row) => row.submissionStatus === "NOT_STARTED").length} not started`}
        actions={
          <Select aria-label="Filter by status" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            <option value="all">All statuses</option>
            <option value="Draft">Draft / not started</option>
            <option value="Submitted">Submitted</option>
            <option value="Evaluated">Evaluated</option>
          </Select>
        }
      >
        {submissions.isError ? <Notice tone="red">{errorMessage(submissions.error, "Submissions could not be loaded.")}</Notice> : null}
        <Table className="min-w-[1100px]">
          <TableCaption className="sr-only">Team submissions with links, status, and judges.</TableCaption>
          <TableHeader>
            <TableRow>
              {["Team", "Code", "Project", "Links", "Status", "Judges", "Submitted", ""].map((label) => (
                <TableHead key={label} className="h-10 normal-case tracking-tighter">{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.isPending ? (
              <TableRow><TableCell colSpan={8}><div className="h-5 w-full animate-pulse rounded bg-zinc-100" /></TableCell></TableRow>
            ) : visible.length ? visible.map((row) => (
              <Fragment key={row.registrationId}>
                <TableRow>
                  <TableCell className="font-medium">{row.teamName}<p className="text-xs text-muted-foreground">{row.teamId}</p></TableCell>
                  <TableCell className="font-mono text-xs">{row.anonymousCode ?? "—"}</TableCell>
                  <TableCell>{row.projectName || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.links.length ? row.links.map((link) => (
                        <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs hover:bg-zinc-200">
                          {link.label}<ExternalLink className="size-3" />
                        </a>
                      )) : "—"}
                    </div>
                  </TableCell>
                  <TableCell><Badge tone={statusTone[row.status]}>{row.status}</Badge>{row.evaluations ? <p className="text-xs text-muted-foreground">{row.evaluations} score{row.evaluations === 1 ? "" : "s"}</p> : null}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {row.judges.map((judge) => (
                        <span key={judge.assignmentId} className="text-xs">{judge.display_name} <StatusBadge status={judge.scorecardStatus} /></span>
                      ))}
                      {canAssign && row.canAssign && evaluators.data ? (
                        <Select
                          aria-label={`Add a judge for ${row.teamName}`}
                          value=""
                          disabled={assign.isPending}
                          onChange={(event) => {
                            const email = event.target.value
                            if (email) run(assign.mutateAsync({ registrationId: row.registrationId, email }), "Judge assigned.")
                          }}
                          className="h-7 text-xs"
                        >
                          <option value="">Add judge…</option>
                          {evaluators.data.evaluators
                            .filter((judge) => !row.judges.some((slot) => slot.email === judge.email))
                            .map((judge) => <option key={judge.email} value={judge.email}>{judge.display_name} ({judge.assignments})</option>)}
                        </Select>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{dateTime(row.endTime)}<p className="text-muted-foreground">updated {dateTime(row.updatedAt)}</p></TableCell>
                  <TableCell className="text-right">
                    <Button onClick={() => setExpanded((current) => current === row.registrationId ? null : row.registrationId)} aria-expanded={expanded === row.registrationId}>
                      {expanded === row.registrationId ? "Hide" : "Details"}
                    </Button>
                  </TableCell>
                </TableRow>
                {expanded === row.registrationId ? (
                  <TableRow className="bg-zinc-50 hover:bg-zinc-50">
                    <TableCell colSpan={8} className="whitespace-normal p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <p className="max-w-3xl whitespace-pre-wrap text-sm">{row.description || "No description provided."}</p>
                        {row.submissionStatus === "SUBMITTED" && can.eventControl(roles) ? (
                          <ConfirmButton confirmLabel="Reopen for editing" disabled={reopen.isPending}
                            onConfirm={() => run(reopen.mutateAsync(row.registrationId), "Submission reopened; the team can edit and finalize again.")}>
                            Reopen submission
                          </ConfirmButton>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            )) : (
              <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No submissions match this filter.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>
    </div>
  )
}
