"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Fragment, Suspense, useState } from "react"

import { useQuery } from "@tanstack/react-query"
import { ExternalLink, Lock } from "lucide-react"

import { Badge, Button, ConfirmButton, Field, LoadingRows, Notice, PageHeader, Panel, Select, StatusBadge, TextInput } from "@/components/admin/kit"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { adminQuery, evaluatorsSchema, submissionsSchema, toSubmissions, type Submission } from "@/lib/admin-client"
import { dateTime, errorMessage } from "@/lib/api"
import { can, keys, useAdminMutation, useMe } from "@/lib/queries"
import { notify } from "@/lib/notify"
import { PLACEMENTS, useStages } from "@/lib/stages"

const statusTone = { Draft: "zinc", Submitted: "amber", Evaluated: "green" } as const

const AREAS = [["submissions"], ["stages"]]

export default function SubmissionsPage() {
  return (
    <Suspense fallback={<LoadingRows />}>
      <Submissions />
    </Suspense>
  )
}

function Submissions() {
  const me = useMe()
  const roles = me.data?.user.roles ?? []
  const canAssign = can.assign(roles)
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const stages = useStages()
  // The event and track live in the URL so a reload or a shared link keeps the same view.
  const stageId = params?.get("event") || stages.data?.items[0]?.id || ""
  const trackParam = params?.get("track") ?? ""
  // "none" lists teams that have not locked a problem statement yet; it is filtered here, not by the API.
  const unchosen = trackParam === "none"
  const trackId = unchosen ? "" : trackParam
  const query = `stage_id=${encodeURIComponent(stageId)}${trackId ? `&track_id=${encodeURIComponent(trackId)}` : ""}`
  const submissions = useQuery({
    queryKey: keys.submissions(stageId, trackId),
    queryFn: adminQuery(`/api/admin/submissions?${query}`, submissionsSchema),
    refetchInterval: 30_000,
    enabled: Boolean(stageId),
  })
  // Only assigners may list judges; asking otherwise is a 403 that used to break this page.
  const evaluators = useQuery({
    queryKey: keys.evaluators,
    queryFn: adminQuery("/api/admin/evaluators", evaluatorsSchema),
    enabled: canAssign,
  })
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | Submission["status"]>("all")
  const assign = useAdminMutation<{ registrationId: string; email: string }>(
    ({ registrationId, email }) => ({ path: `/api/admin/submissions/${registrationId}/assign?stage_id=${stageId}`, body: { assignee_email: email } }),
    [["submissions"], ["evaluators"], ["board"]]
  )
  const reopen = useAdminMutation<string>((registrationId) => ({ path: `/api/admin/submissions/${registrationId}/reopen?stage_id=${stageId}` }), [["submissions"]])
  const removeAward = useAdminMutation<string>((id) => ({ path: `/api/admin/awards/${id}`, method: "DELETE" }), AREAS)

  function select(next: { event?: string; track?: string }) {
    const search = new URLSearchParams(params?.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value) search.set(key, value)
      else search.delete(key)
    }
    router.replace(`${pathname}?${search.toString()}`, { scroll: false })
  }

  const rows = submissions.data ? toSubmissions(submissions.data) : []
  const visible = rows.filter((row) => (filter === "all" || row.status === filter) && (!unchosen || !row.track))
  const round = submissions.data?.round
  const stage = submissions.data?.stage
  const tracks = submissions.data?.tracks ?? []
  const winners = rows.filter((row) => row.awards.length)

  function run(promise: Promise<unknown>, success: string) {
    void notify(promise, success)
  }

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader
        title="Submissions"
        description={round ? `Project links from each event. New judges are assigned to ${round.name} (${round.status.toLowerCase()}).` : "Project links from each event. Create a round for this event under Rounds & Results to start judging."}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Event">
              <Select value={stageId} onChange={(event) => select({ event: event.target.value, track: "" })} disabled={!stages.data}>
                {(stages.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}{item.published ? "" : " (hidden)"}</option>)}
              </Select>
            </Field>
            <Field label="Problem statement">
              <Select value={trackParam} onChange={(event) => select({ track: event.target.value })} disabled={!tracks.length}>
                <option value="">All problem statements</option>
                {tracks.map((track) => <option key={track.id} value={track.id}>{track.title}</option>)}
                {tracks.length > 1 ? <option value="none">Not chosen yet</option> : null}
              </Select>
            </Field>
          </div>
        }
      />
      {stages.isError ? <Notice tone="red">{errorMessage(stages.error, "Events could not be loaded.")}</Notice> : null}
      {winners.length ? (
        <Panel title="Winners" description={`Placings in ${stage?.name ?? "this event"}${trackId ? " for this problem statement" : ""}. Mark them from a submission's details.`}>
          <ul className="flex flex-wrap gap-2">
            {winners.flatMap((row) => row.awards.map((award) => (
              <li key={award.id} className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-sm">
                <Badge tone="amber">{award.label}</Badge>
                <span className="font-medium">{row.projectName || row.teamName}</span>
                <span className="text-xs text-muted-foreground">{award.track ? award.track.title : "Overall"} · {row.teamName}</span>
              </li>
            )))}
          </ul>
        </Panel>
      ) : null}
      <Panel
        title={stage ? `${stage.name} submissions` : "Submissions"}
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
            {submissions.isPending || !stageId ? (
              <TableRow><TableCell colSpan={8}><div className="h-5 w-full animate-pulse rounded bg-muted" /></TableCell></TableRow>
            ) : visible.length ? visible.map((row) => (
              <Fragment key={row.registrationId}>
                <TableRow>
                  <TableCell className="font-medium">{row.teamName}<p className="text-xs text-muted-foreground">{row.teamId}</p></TableCell>
                  <TableCell className="font-mono text-xs">{row.anonymousCode ?? "—"}</TableCell>
                  <TableCell>
                    {row.projectName || "—"}
                    {row.track ? (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        {row.trackLockedAt ? <Lock className="size-3 shrink-0 text-amber-600" aria-label="Locked" /> : null}{row.track.title}
                      </p>
                    ) : tracks.length > 1 ? <p className="text-xs text-amber-700">Track not chosen</p> : null}
                    {row.awards.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {row.awards.map((award) => <Badge key={award.id} tone="amber">{award.label}{award.track && !trackId ? ` · ${award.track.title}` : ""}</Badge>)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.links.length ? row.links.map((link) => (
                        <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs hover:bg-foreground/10">
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
                  <TableCell className="text-xs">
                    {dateTime(row.endTime)}<p className="text-muted-foreground">updated {dateTime(row.updatedAt)}</p>
                    {row.timer ? (
                      <p className={row.timer.state === "EXPIRED" ? "text-red-600" : row.timer.state === "RUNNING" ? "text-emerald-700" : "text-muted-foreground"}>
                        {row.timer.state === "NOT_STARTED" ? "Clock not started"
                          : row.timer.state === "RUNNING" ? `Started ${dateTime(row.timer.started_at)} · ends ${dateTime(row.timer.deadline)}`
                          : row.timer.started_at ? `Time up ${dateTime(row.timer.deadline)}` : "Never started"}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button onClick={() => setExpanded((current) => current === row.registrationId ? null : row.registrationId)} aria-expanded={expanded === row.registrationId}>
                      {expanded === row.registrationId ? "Hide" : "Details"}
                    </Button>
                  </TableCell>
                </TableRow>
                {expanded === row.registrationId ? (
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={8} className="whitespace-normal p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <p className="max-w-3xl whitespace-pre-wrap text-sm">{row.description || "No description provided."}</p>
                        {row.submissionStatus === "SUBMITTED" && row.submissionId && canAssign ? (
                          <AwardControls
                            submissionId={row.submissionId}
                            track={row.track}
                            awards={row.awards}
                            onRemove={(id) => run(removeAward.mutateAsync(id), "Placing removed.")}
                            busy={removeAward.isPending}
                          />
                        ) : null}
                        {tracks.length > 1 && can.eventControl(roles) ? (
                          <TrackControls stageId={stageId} registrationId={row.registrationId} current={row.track} tracks={tracks} hasTrackAward={row.awards.some((award) => award.track)} />
                        ) : null}
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

type AwardRow = Submission["awards"][number]

/** Teams cannot undo their track choice; organisers move or unlock it here, with a reason for the audit log. */
function TrackControls({ stageId, registrationId, current, tracks, hasTrackAward }: {
  stageId: string
  registrationId: string
  current: Submission["track"]
  tracks: { id: string; title: string }[]
  hasTrackAward: boolean
}) {
  const [next, setNext] = useState(current?.id ?? "")
  const [reason, setReason] = useState("")
  const change = useAdminMutation<{ track_id: string | null; reason: string }>(
    (body) => ({ path: `/api/admin/stages/${stageId}/teams/${registrationId}/track`, method: "PUT", body }), [["submissions"], ["teams"]]
  )
  const unchanged = next === (current?.id ?? "")

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-card p-3">
      <p className="inline-flex items-center gap-1 text-sm font-medium"><Lock className="size-3.5" />Problem statement</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Track">
          <Select value={next} onChange={(event) => setNext(event.target.value)}>
            <option value="">{current ? "Unlock (team picks again)" : "Not chosen"}</option>
            {tracks.map((track) => <option key={track.id} value={track.id}>{track.title}</option>)}
          </Select>
        </Field>
        <Field label="Reason">
          <TextInput value={reason} maxLength={300} placeholder="Team asked at the desk" className="w-48" onChange={(event) => setReason(event.target.value)} />
        </Field>
        <Button tone="amber" disabled={change.isPending || unchanged || reason.trim().length < 3 || hasTrackAward}
          title={hasTrackAward ? "Remove this team's track placing first." : undefined}
          onClick={() => void notify(change.mutateAsync({ track_id: next || null, reason: reason.trim() }), next ? "Track changed." : "Track unlocked; the team can pick again.", () => setReason(""))}>
          {next ? "Change track" : "Unlock"}
        </Button>
      </div>
    </div>
  )
}

/** Mark a final submission as a winner in its problem statement or across the whole event. */
function AwardControls({ submissionId, track, awards, onRemove, busy }: {
  submissionId: string
  track: Submission["track"]
  awards: AwardRow[]
  onRemove: (id: string) => void
  busy: boolean
}) {
  const [placement, setPlacement] = useState(1)
  const [scope, setScope] = useState<"track" | "overall">(track ? "track" : "overall")
  const [label, setLabel] = useState("")
  const add = useAdminMutation<{ placement: number; label: string; track_id: string | null }>(
    (body) => ({ path: `/api/admin/submissions/${submissionId}/awards`, body }), AREAS
  )
  const scopeTaken = awards.some((award) => (scope === "track" ? award.track?.id === track?.id : award.track === null))

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-card p-3">
      <p className="text-sm font-medium">Winner</p>
      {awards.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {awards.map((award) => (
            <li key={award.id} className="flex items-center gap-1 text-sm">
              <Badge tone="amber">{award.label}</Badge>
              <span className="text-xs text-muted-foreground">{award.track ? award.track.title : "overall"}</span>
              <ConfirmButton confirmLabel="Remove placing" disabled={busy} onConfirm={() => onRemove(award.id)}>Remove</ConfirmButton>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Placing">
          <Select value={placement} onChange={(event) => setPlacement(Number(event.target.value))}>
            {PLACEMENTS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </Select>
        </Field>
        <Field label="In">
          <Select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}>
            {track ? <option value="track">{track.title}</option> : null}
            <option value="overall">Whole event</option>
          </Select>
        </Field>
        <Field label="Title (optional)">
          <TextInput value={label} maxLength={80} placeholder="Best UI" className="w-36" onChange={(event) => setLabel(event.target.value)} />
        </Field>
        <Button tone="green" disabled={add.isPending || scopeTaken}
          title={scopeTaken ? "This submission already has a placing here; remove it first." : undefined}
          onClick={() => void notify(add.mutateAsync({ placement, label: label.trim(), track_id: scope === "track" && track ? track.id : null }), "Winner marked.", () => setLabel(""))}>
          Mark winner
        </Button>
      </div>
    </div>
  )
}
