"use client"

import { useState } from "react"

import { useQuery } from "@tanstack/react-query"

import { Badge, Button, ConfirmButton, Empty, Field, LoadingRows, Notice, PageHeader, Panel, Select, StatusBadge, TextInput } from "@/components/admin/kit"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { adminQuery, evaluatorsSchema, submissionsSchema } from "@/lib/admin-client"
import { dateTime, errorMessage } from "@/lib/api"
import { can, keys, useAdminMutation, useAdminQuery, useMe } from "@/lib/queries"

type Criterion = { key: string; label: string; max_score: number; weight: number }
type Round = {
  id: string
  name: string
  sequence: number
  status: "DRAFT" | "OPEN" | "CLOSED"
  scope: "ALL_SUBMITTED" | "SHORTLIST"
  min_evaluations: number
  results_status: "NONE" | "DRAFT" | "LOCKED" | "RELEASED"
  assignments: number
  submitted_scorecards: number
  criteria: Criterion[]
}
type BoardJudge = { assignment_id: string; email: string; display_name: string; scorecard_id: string | null; scorecard_status: string }
type Board = {
  round: Round
  teams: { registration_id: string; team_id: string; team_name: string; anonymous_code: string | null; project_name: string; judges: BoardJudge[]; submitted: number }[]
  shortlist: string[]
}
type ResultRow = { registration_id: string; team_id: string; rank: number | null; score: number | null; evaluations: number; eligible: boolean; reason: string | null; team_name: string; project_name: string }
type Results = {
  round: Round
  snapshot: { status: string; generated_at: string; locked_at: string | null; released_at: string | null; rows: ResultRow[] } | null
  live_preview: { registration_id: string; team_name: string; project_name: string; anonymous_code: string | null; score: number | null; evaluations: number; eligible: boolean; reason: string | null }[]
}

const JUDGING_AREAS = [["rounds"], ["board"], ["results"], ["submissions"], ["evaluations"], ["evaluators"]]
const REASONS: Record<string, string> = { not_enough_evaluations: "Needs more scorecards", balance_due: "Balance due" }

export default function RoundsPage() {
  const me = useMe()
  const roles = me.data?.user.roles ?? []
  const rounds = useAdminQuery<{ items: Round[] }>(keys.rounds, "/api/admin/rounds", { refetchInterval: 30_000 })
  const [selected, setSelected] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string } | null>(null)
  const items = rounds.data?.items ?? []
  const roundId = selected ?? items.find((item) => item.status === "OPEN")?.id ?? items[items.length - 1]?.id ?? null
  const round = items.find((item) => item.id === roundId) ?? null

  function run(promise: Promise<unknown>, success: string, after?: () => void) {
    setMessage(null)
    promise.then(() => { after?.(); setMessage({ tone: "green", text: success }) }).catch((error) => setMessage({ tone: "red", text: errorMessage(error) }))
  }

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader
        title="Rounds & Results"
        description="Set up judging rounds, assign judges, then generate, lock, and release results. Nothing is public until you release it."
        actions={items.length ? (
          <Field label="Round">
            <Select value={roundId ?? ""} onChange={(event) => setSelected(event.target.value)}>
              {items.map((item) => <option key={item.id} value={item.id}>{item.sequence}. {item.name} ({item.status.toLowerCase()})</option>)}
            </Select>
          </Field>
        ) : null}
      />
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {rounds.isError ? <Notice tone="red">{errorMessage(rounds.error, "Rounds could not be loaded.")}</Notice> : null}
      {can.assign(roles) ? <NewRound onCreated={(id) => setSelected(id)} run={run} /> : null}
      {rounds.isPending ? <LoadingRows /> : round ? (
        <>
          <RoundSettings key={round.id} round={round} roles={roles} run={run} />
          <RoundBoard round={round} roles={roles} run={run} />
          <RoundResults round={round} roles={roles} run={run} />
        </>
      ) : <Panel><Empty>No rounds yet. Create the first round to start judging.</Empty></Panel>}
    </div>
  )
}

type Run = (promise: Promise<unknown>, success: string, after?: () => void) => void

function NewRound({ onCreated, run }: { onCreated: (id: string) => void; run: Run }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: "", scope: "ALL_SUBMITTED", min_evaluations: 1 })
  const create = useAdminMutation<typeof form, Round>((body) => ({ path: "/api/admin/rounds", body }), JUDGING_AREAS)
  if (!open) return <div><Button onClick={() => setOpen(true)}>New round</Button></div>
  return (
    <Panel title="New round" description="New rounds start as drafts with the default five-criterion rubric.">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Name"><TextInput value={form.name} maxLength={120} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Finals" /></Field>
        <Field label="Who is judged">
          <Select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })}>
            <option value="ALL_SUBMITTED">Every final submission</option>
            <option value="SHORTLIST">Only shortlisted teams</option>
          </Select>
        </Field>
        <Field label="Scorecards needed per team">
          <TextInput type="number" min={1} max={20} value={form.min_evaluations} onChange={(event) => setForm({ ...form, min_evaluations: Number(event.target.value) })} className="w-24" />
        </Field>
        <Button tone="green" disabled={!form.name.trim() || create.isPending}
          onClick={() => run(create.mutateAsync({ ...form, name: form.name.trim() }).then((created) => onCreated(created.id)), "Round created.", () => setOpen(false))}>Create</Button>
        <Button onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </Panel>
  )
}

function RoundSettings({ round, roles, run }: { round: Round; roles: string[]; run: Run }) {
  const editable = can.assign(roles)
  const update = useAdminMutation<Partial<Round>>((body) => ({ path: `/api/admin/rounds/${round.id}`, method: "PATCH", body }), JUDGING_AREAS)
  const [minEvaluations, setMinEvaluations] = useState(round.min_evaluations)

  return (
    <Panel
      title={`${round.name}`}
      description={`${round.scope === "SHORTLIST" ? "Shortlisted teams" : "Every final submission"} · ${round.assignments} assignments · ${round.submitted_scorecards} scorecards submitted`}
      actions={
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge status={round.status} />
          {editable ? (
            <>
              {round.status !== "OPEN" ? <ConfirmButton tone="green" confirmLabel="Open for scoring" disabled={update.isPending} onConfirm={() => run(update.mutateAsync({ status: "OPEN" }), "Round opened; judges can score now.")}>Open round</ConfirmButton> : null}
              {round.status === "OPEN" ? <ConfirmButton confirmLabel="Close scoring" disabled={update.isPending} onConfirm={() => run(update.mutateAsync({ status: "CLOSED" }), "Round closed; scores are frozen.")}>Close round</ConfirmButton> : null}
            </>
          ) : null}
        </span>
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Scorecards needed per team">
          <TextInput type="number" min={1} max={20} value={minEvaluations} disabled={!editable} onChange={(event) => setMinEvaluations(Number(event.target.value))} className="w-24" />
        </Field>
        {editable && minEvaluations !== round.min_evaluations ? (
          <Button tone="green" disabled={update.isPending || minEvaluations < 1} onClick={() => run(update.mutateAsync({ min_evaluations: minEvaluations }), "Minimum updated.")}>Save</Button>
        ) : null}
      </div>
      {/* Remounted only when the saved rubric changes, so background refetches keep unsaved edits. */}
      <RubricEditor key={JSON.stringify(round.criteria)} round={round} editable={editable} run={run} />
    </Panel>
  )
}

function RubricEditor({ round, editable, run }: { round: Round; editable: boolean; run: Run }) {
  const rubric = useAdminMutation<{ criteria: Criterion[] }>((body) => ({ path: `/api/admin/rounds/${round.id}/criteria`, method: "PUT", body }), JUDGING_AREAS)
  const [criteria, setCriteria] = useState<Criterion[]>(round.criteria)
  const rubricChanged = JSON.stringify(criteria) !== JSON.stringify(round.criteria)
  const keysValid = criteria.length > 0 && criteria.every((item) => /^[a-z][a-z0-9_]{0,59}$/.test(item.key) && item.label.trim() && item.max_score > 0 && item.weight > 0)
    && new Set(criteria.map((item) => item.key)).size === criteria.length
  return (
    <>
      <h3 className="mt-4 mb-2 font-medium tracking-tight">Rubric {round.submitted_scorecards ? <Badge>locked: scoring started</Badge> : null}</h3>
      <div className="grid gap-2">
        {criteria.map((criterion, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[10rem_1fr_6rem_6rem_auto] sm:items-end">
            <Field label="Key"><TextInput value={criterion.key} disabled={!editable || round.submitted_scorecards > 0} onChange={(event) => setCriteria(criteria.map((item, position) => position === index ? { ...item, key: event.target.value.toLowerCase() } : item))} /></Field>
            <Field label="Label"><TextInput value={criterion.label} disabled={!editable || round.submitted_scorecards > 0} onChange={(event) => setCriteria(criteria.map((item, position) => position === index ? { ...item, label: event.target.value } : item))} /></Field>
            <Field label="Max score"><TextInput type="number" min={1} max={100} value={criterion.max_score} disabled={!editable || round.submitted_scorecards > 0} onChange={(event) => setCriteria(criteria.map((item, position) => position === index ? { ...item, max_score: Number(event.target.value) } : item))} /></Field>
            <Field label="Weight"><TextInput type="number" min={0.1} step={0.1} value={criterion.weight} disabled={!editable || round.submitted_scorecards > 0} onChange={(event) => setCriteria(criteria.map((item, position) => position === index ? { ...item, weight: Number(event.target.value) } : item))} /></Field>
            {editable && !round.submitted_scorecards ? <Button onClick={() => setCriteria(criteria.filter((_, position) => position !== index))}>Remove</Button> : null}
          </div>
        ))}
        {editable && !round.submitted_scorecards ? (
          <div className="flex gap-2">
            <Button onClick={() => setCriteria([...criteria, { key: `criterion_${criteria.length + 1}`, label: "", max_score: 10, weight: 1 }])}>Add criterion</Button>
            {rubricChanged ? <Button tone="green" disabled={!keysValid || rubric.isPending} onClick={() => run(rubric.mutateAsync({ criteria }), "Rubric saved.")}>Save rubric</Button> : null}
          </div>
        ) : null}
        {!keysValid ? <p className="text-xs text-red-600">Keys must be unique lowercase identifiers; every criterion needs a label, max score, and weight.</p> : null}
      </div>
    </>
  )
}

function RoundBoard({ round, roles, run }: { round: Round; roles: string[]; run: Run }) {
  const editable = can.assign(roles) && round.status !== "CLOSED"
  const board = useAdminQuery<Board>(keys.board(round.id), `/api/admin/rounds/${round.id}/board`, { refetchInterval: 30_000 })
  const judges = useQuery({ queryKey: keys.evaluators, queryFn: adminQuery("/api/admin/evaluators", evaluatorsSchema), enabled: can.assign(roles) })
  const submissions = useQuery({ queryKey: keys.submissions, queryFn: adminQuery("/api/admin/submissions", submissionsSchema), enabled: can.assign(roles) && round.scope === "SHORTLIST" })
  const add = useAdminMutation<{ registration_id: string; judge_emails: string[] }>((body) => ({ path: `/api/admin/rounds/${round.id}/assignments`, body }), JUDGING_AREAS)
  const removeJudge = useAdminMutation<string>((id) => ({ path: `/api/admin/assignments/${id}`, method: "DELETE" }), JUDGING_AREAS)
  const auto = useAdminMutation<{ judges_per_submission: number }, { created: number }>((body) => ({ path: `/api/admin/rounds/${round.id}/auto-assign`, body }), JUDGING_AREAS)
  const advance = useAdminMutation<string[]>((ids) => ({ path: `/api/admin/rounds/${round.id}/entries`, body: { registration_ids: ids } }), JUDGING_AREAS)
  const dropEntry = useAdminMutation<string>((id) => ({ path: `/api/admin/rounds/${round.id}/entries/${id}`, method: "DELETE" }), JUDGING_AREAS)
  const [perSubmission, setPerSubmission] = useState(2)
  const [picked, setPicked] = useState<string[]>([])

  const teams = board.data?.teams ?? []
  const shortlist = new Set(board.data?.shortlist ?? [])
  const candidates = (submissions.data?.submissions ?? []).filter((item) => item.submission_status === "SUBMITTED" && !shortlist.has(item.registration_id))

  return (
    <Panel
      title="Judging board"
      description={`${teams.length} team${teams.length === 1 ? "" : "s"} in this round · team names are never shown to judges`}
      actions={editable ? (
        <span className="flex items-end gap-2">
          <Field label="Judges per team"><TextInput type="number" min={1} max={10} value={perSubmission} onChange={(event) => setPerSubmission(Number(event.target.value))} className="w-20" /></Field>
          <ConfirmButton tone="green" confirmLabel={`Fill to ${perSubmission} judges`} disabled={auto.isPending || perSubmission < 1}
            onConfirm={() => run(auto.mutateAsync({ judges_per_submission: perSubmission }), "Judges assigned, least-loaded first.")}>Auto-assign</ConfirmButton>
        </span>
      ) : null}
    >
      {board.isError ? <Notice tone="red">{errorMessage(board.error, "The board could not be loaded.")}</Notice> : null}
      {round.scope === "SHORTLIST" && can.assign(roles) ? (
        <div className="mb-4 rounded-xl bg-zinc-50 p-3">
          <p className="mb-2 text-sm font-medium">Shortlist: advance final submissions into this round</p>
          {candidates.length ? (
            <div className="flex flex-wrap gap-2">
              {candidates.map((item) => (
                <label key={item.registration_id} className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-xs">
                  <input type="checkbox" checked={picked.includes(item.registration_id)} onChange={(event) => setPicked(event.target.checked ? [...picked, item.registration_id] : picked.filter((id) => id !== item.registration_id))} />
                  {item.team_name}
                </label>
              ))}
              <Button tone="green" disabled={!picked.length || advance.isPending} onClick={() => run(advance.mutateAsync(picked), `${picked.length} team(s) advanced.`, () => setPicked([]))}>Advance {picked.length || ""}</Button>
            </div>
          ) : <p className="text-xs text-muted-foreground">Every final submission is already on the shortlist.</p>}
        </div>
      ) : null}
      {board.isPending ? <LoadingRows /> : teams.length ? (
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              {["Team", "Code", "Project", "Judges", "Progress", ""].map((label) => <TableHead key={label} className="h-10 normal-case tracking-tighter">{label}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team) => (
              <TableRow key={team.registration_id}>
                <TableCell className="font-medium">{team.team_name}<p className="text-xs text-muted-foreground">{team.team_id}</p></TableCell>
                <TableCell className="font-mono text-xs">{team.anonymous_code}</TableCell>
                <TableCell>{team.project_name}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {team.judges.map((judge) => (
                      <span key={judge.assignment_id} className="flex items-center gap-1 text-xs">
                        {judge.display_name} <StatusBadge status={judge.scorecard_status} />
                        {editable && judge.scorecard_status !== "SUBMITTED" ? (
                          <button type="button" className="text-red-600 underline" onClick={() => run(removeJudge.mutateAsync(judge.assignment_id), "Judge removed.")}>remove</button>
                        ) : null}
                      </span>
                    ))}
                    {editable && judges.data ? (
                      <Select value="" className="h-7 text-xs" aria-label={`Add a judge for ${team.team_name}`} disabled={add.isPending}
                        onChange={(event) => { if (event.target.value) run(add.mutateAsync({ registration_id: team.registration_id, judge_emails: [event.target.value] }), "Judge assigned.") }}>
                        <option value="">Add judge…</option>
                        {judges.data.evaluators.filter((judge) => !team.judges.some((item) => item.email === judge.email)).map((judge) => (
                          <option key={judge.email} value={judge.email}>{judge.display_name} ({judge.assignments})</option>
                        ))}
                      </Select>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell><Badge tone={team.submitted >= round.min_evaluations ? "green" : "amber"}>{team.submitted}/{round.min_evaluations}</Badge></TableCell>
                <TableCell className="text-right">
                  {round.scope === "SHORTLIST" && editable && !team.judges.length ? (
                    <button type="button" className="text-xs underline" onClick={() => run(dropEntry.mutateAsync(team.registration_id), "Removed from the shortlist.")}>Remove from shortlist</button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : <Empty>{round.scope === "SHORTLIST" ? "No teams shortlisted yet." : "No final submissions yet."}</Empty>}
    </Panel>
  )
}

function RoundResults({ round, roles, run }: { round: Round; roles: string[]; run: Run }) {
  const results = useAdminQuery<Results>(keys.results(round.id), `/api/admin/rounds/${round.id}/results`, { refetchInterval: 30_000 })
  const action = useAdminMutation<string>((name) => ({ path: `/api/admin/rounds/${round.id}/results/${name}` }), JUDGING_AREAS)
  const snapshot = results.data?.snapshot ?? null
  const status = snapshot?.status ?? "NONE"
  const rows = snapshot?.rows ?? []

  return (
    <Panel
      title="Results"
      description={snapshot ? `Generated ${dateTime(snapshot.generated_at)}${snapshot.released_at ? ` · released ${dateTime(snapshot.released_at)}` : ""}` : "Not generated yet. The live preview below updates as judges submit."}
      actions={
        <span className="flex flex-wrap items-center gap-1">
          <StatusBadge status={status === "NONE" ? "PENDING" : status} label={status === "NONE" ? "not generated" : status.toLowerCase()} />
          {can.assign(roles) && (status === "NONE" || status === "DRAFT") ? <Button disabled={action.isPending} onClick={() => run(action.mutateAsync("generate"), "Results generated from submitted scorecards.")}>{status === "DRAFT" ? "Regenerate" : "Generate"}</Button> : null}
          {can.eventControl(roles) && status === "DRAFT" ? <ConfirmButton tone="amber" confirmLabel="Lock results" disabled={action.isPending} onConfirm={() => run(action.mutateAsync("lock"), "Results locked.")}>Lock</ConfirmButton> : null}
          {can.superAdmin(roles) && status === "LOCKED" ? <ConfirmButton confirmLabel="Unlock" disabled={action.isPending} onConfirm={() => run(action.mutateAsync("unlock"), "Results unlocked.")}>Unlock</ConfirmButton> : null}
          {can.eventControl(roles) && status === "LOCKED" ? <ConfirmButton tone="green" confirmLabel="Release publicly" disabled={action.isPending} onConfirm={() => run(action.mutateAsync("release"), "Results released to teams and the public leaderboard.")}>Release</ConfirmButton> : null}
          {can.superAdmin(roles) && status === "RELEASED" ? <ConfirmButton confirmLabel="Unpublish" disabled={action.isPending} onConfirm={() => run(action.mutateAsync("unpublish"), "Results hidden again.")}>Unpublish</ConfirmButton> : null}
        </span>
      }
    >
      {results.isError ? <Notice tone="red">{errorMessage(results.error, "Results could not be loaded.")}</Notice> : null}
      {results.isPending ? <LoadingRows /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 font-medium tracking-tight">{snapshot ? "Frozen snapshot" : "Snapshot"}</h3>
            {rows.length ? (
              <Table>
                <TableHeader><TableRow>{["#", "Team", "Score", "Cards"].map((label) => <TableHead key={label} className="h-9 normal-case tracking-tighter">{label}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.registration_id}>
                      <TableCell className="tabular-nums">{row.rank ?? "—"}</TableCell>
                      <TableCell>{row.team_name}<p className="text-xs text-muted-foreground">{row.project_name}</p></TableCell>
                      <TableCell className="tabular-nums">{row.score?.toFixed(2) ?? "—"}{!row.eligible ? <p className="text-xs text-amber-800">{REASONS[row.reason ?? ""] ?? row.reason}</p> : null}</TableCell>
                      <TableCell className="tabular-nums">{row.evaluations}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <Empty>No snapshot.</Empty>}
          </div>
          <div>
            <h3 className="mb-2 font-medium tracking-tight">Live preview (private)</h3>
            {results.data?.live_preview.length ? (
              <Table>
                <TableHeader><TableRow>{["Team", "Score", "Cards"].map((label) => <TableHead key={label} className="h-9 normal-case tracking-tighter">{label}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {results.data.live_preview.map((row) => (
                    <TableRow key={row.registration_id}>
                      <TableCell>{row.team_name}<p className="text-xs text-muted-foreground">{row.anonymous_code}</p></TableCell>
                      <TableCell className="tabular-nums">{row.score?.toFixed(2) ?? "—"}{!row.eligible ? <p className="text-xs text-amber-800">{REASONS[row.reason ?? ""] ?? row.reason}</p> : null}</TableCell>
                      <TableCell className="tabular-nums">{row.evaluations}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <Empty>No eligible teams yet.</Empty>}
          </div>
        </div>
      )}
    </Panel>
  )
}
