"use client"

import { useState } from "react"

import { useQuery } from "@tanstack/react-query"

import { Badge, ConfirmButton, Empty, Field, Notice, PageHeader, Panel, Select, TextInput } from "@/components/admin/kit"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Bones } from "@/components/admin/bones"
import { adminQuery, evaluationsSchema, toEvaluations } from "@/lib/admin-client"
import { dateTime, errorMessage } from "@/lib/api"
import { can, keys, useAdminMutation, useMe } from "@/lib/queries"
import { notify } from "@/lib/notify"

export default function EvaluationsPage() {
  const me = useMe()
  const canReopen = can.assign(me.data?.user.roles ?? [])
  const evaluations = useQuery({
    queryKey: keys.evaluations,
    queryFn: adminQuery("/api/admin/evaluations", evaluationsSchema),
    select: toEvaluations,
    refetchInterval: 30_000,
  })
  const reopen = useAdminMutation<string>((id) => ({ path: `/api/admin/scorecards/${id}/reopen` }), [["evaluations"], ["submissions"], ["board"], ["results"]])
  const [round, setRound] = useState("all")
  const [search, setSearch] = useState("")

  const rows = evaluations.data ?? []
  const rounds = [...new Map(rows.map((row) => [row.roundId, row.round])).entries()]
  const term = search.trim().toLowerCase()
  const visible = rows.filter((row) =>
    (round === "all" || row.roundId === round) &&
    (!term || [row.teamName, row.teamId, row.anonymousCode ?? "", row.evaluatedBy].some((value) => value.toLowerCase().includes(term)))
  )
  const criteria = visible[0]?.criteria ?? []
  const sameRubric = visible.every((row) => row.roundId === visible[0]?.roundId)

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader title="Evaluations" description="Submitted scorecards. Totals are weighted percentages of each round's rubric." />
      <Panel
        title="Scorecards"
        description={`${visible.length} of ${rows.length} scorecards`}
        actions={
          <>
            <Field label="Round">
              <Select value={round} onChange={(event) => setRound(event.target.value)}>
                <option value="all">All rounds</option>
                {rounds.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </Select>
            </Field>
            <Field label="Search">
              <TextInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Team, submission code or judge" />
            </Field>
          </>
        }
      >
        {evaluations.isError ? <Notice tone="red">{errorMessage(evaluations.error, "Evaluations could not be loaded.")}</Notice> : null}
        <Bones name="evaluations-table" loading={evaluations.isPending}>
        {!visible.length ? <Empty>No submitted scorecards yet.</Empty> : (
          <Table className="min-w-[1000px]">
            <TableCaption className="sr-only">Submitted scorecards with per-criterion scores.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="h-10 normal-case tracking-tighter">Team</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Round</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Judge</TableHead>
                {sameRubric ? criteria.map((criterion) => (
                  <TableHead key={criterion.key} className="h-10 text-center normal-case tracking-tighter">{criterion.label}<span className="block text-[10px] text-muted-foreground">/ {criterion.maxScore}</span></TableHead>
                )) : <TableHead className="h-10 normal-case tracking-tighter">Scores</TableHead>}
                <TableHead className="h-10 text-center normal-case tracking-tighter">Total</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Submitted</TableHead>
                <TableHead className="h-10"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={row.scorecardId}>
                  <TableCell className="font-medium">{row.teamName}<p className="text-xs text-muted-foreground">{row.teamId}</p></TableCell>
                  <TableCell>{row.round}</TableCell>
                  <TableCell>{row.evaluatedBy}{row.comments ? <p className="max-w-56 truncate text-xs text-muted-foreground" title={row.comments}>“{row.comments}”</p> : null}</TableCell>
                  {sameRubric ? criteria.map((criterion) => (
                    <TableCell key={criterion.key} className="text-center tabular-nums">{row.scores[criterion.key] ?? "—"}</TableCell>
                  )) : (
                    <TableCell className="text-xs">{row.criteria.map((criterion) => `${criterion.label}: ${row.scores[criterion.key] ?? "—"}`).join(" · ")}</TableCell>
                  )}
                  <TableCell className="text-center"><Badge tone="green">{row.total.toFixed(1)}%</Badge></TableCell>
                  <TableCell className="text-xs">{dateTime(row.evaluatedAt)}</TableCell>
                  <TableCell className="text-right">
                    {canReopen ? (
                      <ConfirmButton confirmLabel="Reopen" disabled={reopen.isPending}
                        onConfirm={() => {
                          void notify(reopen.mutateAsync(row.scorecardId), "Scorecard reopened; the judge can edit and resubmit.")
                        }}>
                        Reopen
                      </ConfirmButton>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        </Bones>
      </Panel>
    </div>
  )
}
