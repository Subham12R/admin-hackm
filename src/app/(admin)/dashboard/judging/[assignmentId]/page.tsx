"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { ExternalLink } from "lucide-react"

import { Button, ConfirmButton, Field, LoadingRows, Notice, PageHeader, Panel, StatusBadge, TextArea } from "@/components/admin/kit"
import { errorMessage } from "@/lib/api"
import { keys, useAdminMutation, useAdminQuery } from "@/lib/queries"
import { notify } from "@/lib/notify"

type Detail = {
  assignment_id: string
  code: string | null
  project_name: string
  round: { id: string; name: string; status: string }
  scorecard_status: string
  total: number | null
  description: string
  links: { label: string; href: string }[]
  criteria: { key: string; label: string; max_score: number; weight: number }[]
  scores: Record<string, number>
  comments: string
  submitted_at: string | null
}

export default function ScorePage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const detail = useAdminQuery<Detail>(keys.judgeAssignment(assignmentId), `/api/judge/assignments/${assignmentId}`)
  if (detail.isError) return <Notice tone="red">{errorMessage(detail.error, "This assignment could not be loaded.")}</Notice>
  if (!detail.data) return <LoadingRows rows={8} />
  return <ScoreForm key={assignmentId} data={detail.data} />
}

function ScoreForm({ data }: { data: Detail }) {
  const assignmentId = data.assignment_id
  const areas = [["judge-assignment"], ["judge-assignments"]]
  const save = useAdminMutation<{ scores: Record<string, number>; comments: string }>((body) => ({ path: `/api/judge/assignments/${assignmentId}/scorecard`, method: "PUT", body }), areas)
  const submit = useAdminMutation<{ scores: Record<string, number>; comments: string }>((body) => ({ path: `/api/judge/assignments/${assignmentId}/scorecard/submit`, body }), areas)
  const [scores, setScores] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(data.scores).map(([key, value]) => [key, String(value)])))
  const [comments, setComments] = useState(data.comments)

  const writable = data.round.status === "OPEN" && data.scorecard_status !== "SUBMITTED"
  const parsed = Object.fromEntries(Object.entries(scores).filter(([, value]) => value !== "").map(([key, value]) => [key, Number(value)]))
  const invalid = data.criteria.filter((criterion) => criterion.key in parsed && (!Number.isInteger(parsed[criterion.key]) || parsed[criterion.key] < 0 || parsed[criterion.key] > criterion.max_score))
  const complete = data.criteria.every((criterion) => criterion.key in parsed) && !invalid.length
  const weight = data.criteria.reduce((sum, criterion) => sum + criterion.weight, 0)
  const preview = weight ? data.criteria.reduce((sum, criterion) => sum + ((parsed[criterion.key] ?? 0) / criterion.max_score) * criterion.weight, 0) / weight * 100 : 0

  function run(promise: Promise<unknown>, success: string) {
    void notify(promise, success)
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <Link href="/dashboard/judging" className="text-sm underline underline-offset-2">← All assignments</Link>
      <PageHeader title={data.project_name || "Untitled project"} description={`${data.code} · ${data.round.name}`} actions={<StatusBadge status={data.scorecard_status} />} />
      {data.round.status !== "OPEN" ? <Notice tone="amber">This round is {data.round.status.toLowerCase()}; scoring is {data.round.status === "DRAFT" ? "not open yet" : "closed"}.</Notice> : null}
      <Panel title="Project">
        <p className="whitespace-pre-wrap text-sm">{data.description || "No description provided."}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.links.map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm hover:bg-foreground/10">
              {link.label}<ExternalLink className="size-3.5" />
            </a>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Repository links can reveal usernames. Score the work, and declare any conflict of interest to the organisers.</p>
      </Panel>
      <Panel title="Scorecard" description={`Weighted total: ${preview.toFixed(1)}%`}>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.criteria.map((criterion) => (
            <Field key={criterion.key} label={`${criterion.label} (0–${criterion.max_score}${criterion.weight !== 1 ? `, weight ${criterion.weight}` : ""})`}
              hint={invalid.includes(criterion) ? `Whole number from 0 to ${criterion.max_score}` : undefined}>
              <input type="number" min={0} max={criterion.max_score} step={1} disabled={!writable} value={scores[criterion.key] ?? ""}
                onChange={(event) => setScores({ ...scores, [criterion.key]: event.target.value })}
                className="h-9 rounded-md border border-border bg-card px-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted/50" />
            </Field>
          ))}
        </div>
        <div className="mt-3">
          <Field label="Comments for the organisers (optional)">
            <TextArea value={comments} disabled={!writable} maxLength={4000} onChange={(event) => setComments(event.target.value)} />
          </Field>
        </div>
        {writable ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={save.isPending || invalid.length > 0} onClick={() => run(save.mutateAsync({ scores: parsed, comments }), "Draft saved.")}>Save draft</Button>
            <ConfirmButton tone="green" confirmLabel="Submit final scores" disabled={!complete || submit.isPending}
              onConfirm={() => run(submit.mutateAsync({ scores: parsed, comments }), "Scores submitted. Thank you!")}>
              Submit
            </ConfirmButton>
            {!complete ? <span className="self-center text-xs text-muted-foreground">Score every criterion to submit.</span> : null}
          </div>
        ) : data.scorecard_status === "SUBMITTED" ? <p className="mt-3 text-sm text-muted-foreground">Submitted. Ask an evaluation admin to reopen it if you need a change.</p> : null}
      </Panel>
    </div>
  )
}
