"use client"

import { useState } from "react"
import { Download } from "lucide-react"

import { Badge, Button, Field, Notice, Select, TextArea, TextInput } from "@/components/admin/kit"
import { useAdminMutation } from "@/lib/queries"

export type Criterion = { key: string; label: string; description: string; max_score: number; weight: number }
export type RubricRound = {
  id: string
  name: string
  sequence: number
  status: "DRAFT" | "OPEN" | "CLOSED"
  scorecards_started: number
  rubric_confirmed_at: string | null
  criteria: Criterion[]
  stage: { id: string; name: string } | null
}

export const JUDGING_AREAS = [["rounds"], ["board"], ["results"], ["submissions"], ["evaluations"], ["evaluators"]]

/** The rubric a new round starts with (src/judging/service.py DEFAULT_CRITERIA). */
const DEFAULT_RUBRIC: Criterion[] = [
  { key: "innovation", label: "Innovation", description: "", max_score: 10, weight: 1 },
  { key: "technical", label: "Technical implementation", description: "", max_score: 10, weight: 1 },
  { key: "problem_solving", label: "Problem solving", description: "", max_score: 10, weight: 1 },
  { key: "ui_ux", label: "UI/UX", description: "", max_score: 10, weight: 1 },
  { key: "completeness", label: "Completeness", description: "", max_score: 10, weight: 1 },
]

/** "UI / UX design" -> "ui_ux_design"; unique among the keys already used. */
function keyFor(label: string, taken: string[]): string {
  const base = (label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "") || "criterion").slice(0, 50)
  let key = base
  for (let index = 2; taken.includes(key); index += 1) key = `${base}_${index}`
  return key
}

function normalize(items: Criterion[]): Criterion[] {
  return items.map((item) => ({ ...item, description: item.description ?? "" }))
}

function csvCell(value: string | number) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadRubric(round: RubricRound, criteria: Criterion[]) {
  const total = criteria.reduce((sum, item) => sum + item.weight, 0) || 1
  const lines = [["Key", "Criterion", "What judges look for", "Max score", "Weight", "Share of total (%)"].join(",")]
  for (const item of criteria) {
    lines.push([item.key, item.label, item.description, item.max_score, item.weight, ((item.weight / total) * 100).toFixed(1)].map(csvCell).join(","))
  }
  const blob = new Blob([`﻿${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `rubric-${round.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

/**
 * The metrics a round is judged on. Before any judge starts a scorecard everything can change;
 * after that only the wording (labels and descriptions), because maximums and weights shape totals
 * already given. Saving confirms the rubric, which the round needs before it can open.
 */
export function RubricEditor({ round, rounds, editable, run }: {
  round: RubricRound
  /** Other rounds to copy a rubric from. */
  rounds: RubricRound[]
  editable: boolean
  run: (promise: Promise<unknown>, success: string) => void
}) {
  const save = useAdminMutation<{ criteria: Criterion[] }>((body) => ({ path: `/api/admin/rounds/${round.id}/criteria`, method: "PUT", body }), JUDGING_AREAS)
  const copy = useAdminMutation<{ from_round_id: string }>((body) => ({ path: `/api/admin/rounds/${round.id}/criteria/copy`, body }), JUDGING_AREAS)
  const saved = normalize(round.criteria)
  const [criteria, setCriteria] = useState<Criterion[]>(saved)
  const [source, setSource] = useState("")
  const locked = round.scorecards_started > 0
  const changed = JSON.stringify(criteria) !== JSON.stringify(saved)
  const confirmed = Boolean(round.rubric_confirmed_at)
  const valid = criteria.length > 0 && criteria.length <= 20 && new Set(criteria.map((item) => item.key)).size === criteria.length
    && criteria.every((item) => item.label.trim() && item.max_score >= 1 && item.max_score <= 100 && item.weight > 0 && item.weight <= 100)
  const totalWeight = criteria.reduce((sum, item) => sum + (item.weight > 0 ? item.weight : 0), 0)
  const others = rounds.filter((item) => item.id !== round.id && item.criteria.length)
  const shapeEditable = editable && !locked

  function patch(index: number, change: Partial<Criterion>) {
    setCriteria(criteria.map((item, position) => (position === index ? { ...item, ...change } : item)))
  }

  function move(index: number, by: number) {
    const next = [...criteria]
    const [item] = next.splice(index, 1)
    next.splice(index + by, 0, item)
    setCriteria(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium tracking-tight">Evaluation metrics</h3>
        {confirmed ? <Badge tone="green">confirmed</Badge> : <Badge tone="amber">not confirmed</Badge>}
        {locked ? <Badge>{round.scorecards_started} scorecard{round.scorecards_started === 1 ? "" : "s"} started: wording only</Badge> : null}
      </div>
      {!confirmed ? (
        <Notice tone="amber">Set the metrics judges score on, then save. The round can&apos;t open until its rubric is confirmed; saving the default one is fine.</Notice>
      ) : null}
      <div className="grid gap-3">
        {criteria.map((criterion, index) => {
          const share = totalWeight ? ((criterion.weight > 0 ? criterion.weight : 0) / totalWeight) * 100 : 0
          return (
            <div key={`${criterion.key}-${index}`} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_6rem_6rem_auto] sm:items-start">
              <div className="grid gap-2">
                <Field label={`Metric ${index + 1}`}>
                  <TextInput value={criterion.label} maxLength={120} disabled={!editable} placeholder="e.g. Real-world impact"
                    onChange={(event) => {
                      const label = event.target.value
                      // New metrics follow their label; saved ones keep their key so scores stay attached.
                      const fresh = !saved.some((item) => item.key === criterion.key) && !locked
                      patch(index, fresh ? { label, key: keyFor(label, criteria.filter((_, position) => position !== index).map((item) => item.key)) } : { label })
                    }} />
                </Field>
                <Field label="What judges should look for (shown on their scorecard)">
                  <TextArea value={criterion.description} maxLength={500} disabled={!editable} className="min-h-14"
                    placeholder="e.g. Does it solve a real problem for real users? 0 = no clear user, 10 = proven need."
                    onChange={(event) => patch(index, { description: event.target.value })} />
                </Field>
              </div>
              <Field label="Max score">
                <TextInput type="number" min={1} max={100} value={criterion.max_score} disabled={!shapeEditable}
                  onChange={(event) => patch(index, { max_score: Number(event.target.value) })} />
              </Field>
              <Field label="Weight" hint={`${share.toFixed(0)}% of total`}>
                <TextInput type="number" min={0.1} max={100} step={0.1} value={criterion.weight} disabled={!shapeEditable}
                  onChange={(event) => patch(index, { weight: Number(event.target.value) })} />
              </Field>
              {shapeEditable ? (
                <div className="flex gap-1 sm:pt-5">
                  <Button aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>↑</Button>
                  <Button aria-label="Move down" disabled={index === criteria.length - 1} onClick={() => move(index, 1)}>↓</Button>
                  <Button aria-label={`Remove ${criterion.label || "metric"}`} onClick={() => setCriteria(criteria.filter((_, position) => position !== index))}>✕</Button>
                </div>
              ) : <span />}
            </div>
          )
        })}
      </div>
      {!valid ? <p className="text-xs text-red-600">Every metric needs a name, a max score from 1 to 100 and a weight above 0 (up to 20 metrics).</p> : null}
      {editable ? (
        <div className="flex flex-wrap items-end gap-2">
          {shapeEditable ? (
            <>
              <Button onClick={() => setCriteria([...criteria, { key: keyFor("criterion", criteria.map((item) => item.key)), label: "", description: "", max_score: 10, weight: 1 }])}>Add metric</Button>
              <Button onClick={() => setCriteria(DEFAULT_RUBRIC)}>Reset to default</Button>
            </>
          ) : null}
          {changed || !confirmed ? (
            <Button tone="green" disabled={!valid || save.isPending}
              onClick={() => run(save.mutateAsync({ criteria: criteria.map((item) => ({ ...item, label: item.label.trim(), description: item.description.trim() })) }),
                changed ? "Rubric saved. Judges see it on their scorecards." : "Rubric confirmed.")}>
              {changed ? "Save rubric" : "Confirm rubric"}
            </Button>
          ) : null}
          {changed ? <Button onClick={() => setCriteria(saved)}>Discard changes</Button> : null}
          {shapeEditable && others.length ? (
            <span className="flex items-end gap-2">
              <Field label="Copy from">
                <Select value={source} onChange={(event) => setSource(event.target.value)}>
                  <option value="">Pick a round…</option>
                  {others.map((item) => <option key={item.id} value={item.id}>{item.sequence}. {item.name}{item.stage ? ` · ${item.stage.name}` : ""}</option>)}
                </Select>
              </Field>
              <Button disabled={!source || copy.isPending} onClick={() => run(copy.mutateAsync({ from_round_id: source }), "Rubric copied and confirmed.")}>Copy</Button>
            </span>
          ) : null}
          <Button onClick={() => downloadRubric(round, criteria)} title="Download the metrics as a CSV, for example to give an evaluation agent">
            <Download className="mr-1 inline size-3.5" aria-hidden="true" />rubric.csv
          </Button>
        </div>
      ) : null}
    </div>
  )
}
