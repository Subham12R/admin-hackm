"use client"

import Link from "next/link"
import { useState } from "react"

import { Badge, Button, ConfirmButton, Empty, Field, LoadingRows, Notice, PageHeader, Panel, Select, StatusBadge, TextArea, TextInput } from "@/components/admin/kit"
import { ApiError, dateTime, errorMessage, fromLocalInput, toLocalInput } from "@/lib/api"
import { notify, toast } from "@/lib/notify"
import { can, useAdminMutation, useMe } from "@/lib/queries"
import { ELIGIBILITY, useStages, type Resource, type Stage, type Track } from "@/lib/stages"

const AREAS = [["stages"], ["submissions"], ["event"], ["challenge"]]
const LINK = /^https?:\/\/\S+$/
const SCHEDULE = [
  ["submission_opens_at", "Submissions open"],
  ["submission_closes_at", "Submissions close"],
  ["statements_release_at", "Problem statements revealed"],
] as const
type ScheduleKey = (typeof SCHEDULE)[number][0]

export default function EventsPage() {
  const me = useMe()
  const editable = can.eventControl(me.data?.user.roles ?? [])
  const stages = useStages()

  if (stages.isError) return <Notice tone="red">{errorMessage(stages.error, "Events could not be loaded.")}</Notice>
  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader
        title="Events"
        description="Each event (online round, grand finale, side challenge) has its own problem statements, submission window, submissions and winners. Teams register once and take part in every published event they qualify for."
      />
      {editable ? <NewEvent /> : null}
      {!stages.data ? <LoadingRows rows={4} /> : stages.data.items.length ? (
        stages.data.items.map((stage) => <StageCard key={`${stage.id}-${stage.updated_at}`} stage={stage} editable={editable} only={stages.data.items.length === 1} />)
      ) : <Panel><Empty>No events yet.</Empty></Panel>}
    </div>
  )
}

function NewEvent() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [eligibility, setEligibility] = useState<Stage["eligibility"]>("FINALISTS")
  const create = useAdminMutation<{ name: string; eligibility: string }>((body) => ({ path: "/api/admin/stages", body }), AREAS)
  if (!open) return <div><Button tone="green" onClick={() => setOpen(true)}>New event</Button></div>
  return (
    <Panel title="New event" description="New events start hidden. Add problem statements and times, then publish it.">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Name"><TextInput value={name} maxLength={200} placeholder="Grand Finale" onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Who takes part">
          <Select value={eligibility} onChange={(event) => setEligibility(event.target.value as Stage["eligibility"])}>
            {Object.entries(ELIGIBILITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <Button tone="green" disabled={!name.trim() || create.isPending}
          onClick={() => void notify(create.mutateAsync({ name: name.trim(), eligibility }), "Event created. It stays hidden until you publish it.", () => { setName(""); setOpen(false) })}>
          Create
        </Button>
        <Button onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </Panel>
  )
}

function scheduleOf(stage: Stage): Record<ScheduleKey, string> {
  return {
    submission_opens_at: toLocalInput(stage.submission_window.opens_at),
    submission_closes_at: toLocalInput(stage.submission_window.closes_at),
    statements_release_at: toLocalInput(stage.statements.release_at),
  }
}

/** Remounted (by key) after every save, so the form always starts from the server copy. */
function StageCard({ stage, editable, only }: { stage: Stage; editable: boolean; only: boolean }) {
  const [initial] = useState(() => ({ name: stage.name, description: stage.description, eligibility: stage.eligibility, schedule: scheduleOf(stage) }))
  const [form, setForm] = useState(initial)
  const save = useAdminMutation<Record<string, unknown>>((body) => ({ path: `/api/admin/stages/${stage.id}`, method: "PATCH", body }), AREAS)
  const remove = useAdminMutation<void>(() => ({ path: `/api/admin/stages/${stage.id}`, method: "DELETE" }), AREAS)
  const addTrack = useAdminMutation<{ title: string }>((body) => ({ path: `/api/admin/stages/${stage.id}/tracks`, body }), AREAS)

  const changedTimes = SCHEDULE.filter(([key]) => form.schedule[key] !== initial.schedule[key])
  const dirty = form.name !== initial.name || form.description !== initial.description || form.eligibility !== initial.eligibility || changedTimes.length > 0

  function submit() {
    const body: Record<string, unknown> = {}
    if (form.name.trim() !== initial.name) body.name = form.name.trim()
    if (form.description !== initial.description) body.description = form.description
    if (form.eligibility !== initial.eligibility) body.eligibility = form.eligibility
    for (const [key] of changedTimes) body[key] = fromLocalInput(form.schedule[key])
    void notify(save.mutateAsync(body), "Event saved. The server enforces the new times now.")
  }

  const submissionWindow = stage.submission_window
  return (
    <Panel
      title={stage.name}
      description={`${ELIGIBILITY[stage.eligibility]} · ${stage.teams} teams · ${stage.submitted} submitted · ${stage.drafts} drafts${stage.awards ? ` · ${stage.awards} placings` : ""}`}
      actions={
        <span className="flex flex-wrap items-center gap-2">
          <Badge tone={stage.published ? "green" : "zinc"}>{stage.published ? "visible to teams" : "hidden"}</Badge>
          <StatusBadge status={submissionWindow.state} label={submissionWindow.state === "OPEN" ? "submissions open" : submissionWindow.state === "CLOSED" ? "submissions closed" : "not open yet"} />
          <Link href={`/dashboard/submissions?event=${stage.id}`} className="text-sm underline">Submissions</Link>
          {editable ? (
            <Button tone={stage.published ? "zinc" : "green"} disabled={save.isPending}
              onClick={() => void notify(save.mutateAsync({ published: !stage.published }), stage.published ? "Event hidden from teams." : "Event published; eligible teams see it on their dashboard.")}>
              {stage.published ? "Hide" : "Publish"}
            </Button>
          ) : null}
        </span>
      }
    >
      <div className="grid gap-4">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (editable && dirty) submit() }}>
          <Field label="Name">
            <TextInput value={form.name} disabled={!editable} maxLength={200} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Who takes part" hint="Finalists are the teams accepted on the Teams page.">
            <Select value={form.eligibility} disabled={!editable} onChange={(event) => setForm({ ...form, eligibility: event.target.value as Stage["eligibility"] })}>
              {Object.entries(ELIGIBILITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Description for teams (optional)">
              <TextArea value={form.description} disabled={!editable} maxLength={5000} rows={2} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </Field>
          </div>
          {SCHEDULE.map(([key, label]) => (
            <Field key={key} label={`${label} (IST)`} hint={form.schedule[key] !== initial.schedule[key] ? "Unsaved change" : key === "statements_release_at" ? "Leave empty to keep them hidden." : undefined}>
              <span className="flex gap-1">
                <TextInput type="datetime-local" disabled={!editable} value={form.schedule[key]} className="flex-1"
                  onChange={(event) => setForm({ ...form, schedule: { ...form.schedule, [key]: event.target.value } })} />
                {editable && form.schedule[key] ? <Button onClick={() => setForm({ ...form, schedule: { ...form.schedule, [key]: "" } })} aria-label={`Clear ${label}`}>Clear</Button> : null}
              </span>
            </Field>
          ))}
          {editable ? (
            <div className="flex flex-wrap items-end gap-2 md:col-span-2">
              <Button tone="green" type="submit" disabled={!dirty || !form.name.trim() || save.isPending}>{save.isPending ? "Saving…" : "Save event"}</Button>
              {dirty ? <Button onClick={() => setForm(initial)}>Discard changes</Button> : null}
              {!only ? (
                <ConfirmButton confirmLabel="Delete event" disabled={remove.isPending}
                  onConfirm={() => void notify(remove.mutateAsync(undefined), "Event deleted.")}>Delete</ConfirmButton>
              ) : null}
            </div>
          ) : null}
        </form>

        <div className="grid gap-3 border-t border-zinc-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">Problem statements</p>
              <p className="text-xs text-muted-foreground">
                {stage.statements.released ? "Teams can read these now." : stage.statements.release_at ? `Revealed to teams ${dateTime(stage.statements.release_at)}.` : "Hidden from teams until you set a reveal time."}
                {stage.tracks.length > 1 ? " Teams pick one when they submit." : ""}
              </p>
            </div>
            {editable ? (
              <Button disabled={addTrack.isPending} onClick={() => void notify(addTrack.mutateAsync({ title: `Problem statement ${stage.tracks.length + 1}` }), "Problem statement added. Edit it below.")}>
                Add problem statement
              </Button>
            ) : null}
          </div>
          {stage.tracks.length ? stage.tracks.map((track) => <TrackEditor key={`${track.id}-${track.version}`} track={track} editable={editable} />) : <Empty>No problem statements yet.</Empty>}
        </div>
      </div>
    </Panel>
  )
}

function TrackEditor({ track, editable }: { track: Track; editable: boolean }) {
  const [form, setForm] = useState({ title: track.title, summary: track.summary, body: track.body, resources: track.resources })
  const [open, setOpen] = useState(false)
  const save = useAdminMutation<typeof form & { version: number }>((body) => ({ path: `/api/admin/tracks/${track.id}`, method: "PUT", body }), AREAS)
  const remove = useAdminMutation<void>(() => ({ path: `/api/admin/tracks/${track.id}`, method: "DELETE" }), AREAS)
  const badLink = form.resources.some((resource) => !resource.label.trim() || !LINK.test(resource.url.trim()))
  const dirty = JSON.stringify(form) !== JSON.stringify({ title: track.title, summary: track.summary, body: track.body, resources: track.resources })

  function setResource(index: number, patch: Partial<Resource>) {
    setForm({ ...form, resources: form.resources.map((item, position) => position === index ? { ...item, ...patch } : item) })
  }

  function submit() {
    const resources = form.resources.map((item) => ({ label: item.label.trim(), url: item.url.trim() }))
    save.mutateAsync({ ...form, title: form.title.trim(), resources, version: track.version })
      .then(() => toast.success(`Saved “${form.title.trim()}”.`))
      .catch((error: unknown) => toast.error(error instanceof ApiError && error.status === 409 ? "Someone else changed this problem statement. Reload the page and try again." : errorMessage(error)))
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="min-w-0 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <p className="truncate font-medium">{track.title}</p>
          <p className="truncate text-xs text-muted-foreground">{track.summary || "No summary"} · {track.resources.length} resource{track.resources.length === 1 ? "" : "s"}</p>
        </button>
        <span className="flex gap-1">
          {dirty ? <Badge tone="amber">unsaved</Badge> : null}
          <Button onClick={() => setOpen(!open)}>{open ? "Close" : editable ? "Edit" : "View"}</Button>
        </span>
      </div>
      {open ? (
        <div className="mt-3 grid gap-3">
          <Field label="Title" error={!form.title.trim() ? "A title is required" : undefined}>
            <TextInput value={form.title} disabled={!editable} maxLength={200} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </Field>
          <Field label="One-line summary">
            <TextInput value={form.summary} disabled={!editable} maxLength={500} onChange={(event) => setForm({ ...form, summary: event.target.value })} />
          </Field>
          <Field label="Full brief" hint="Plain text; line breaks are kept.">
            <TextArea value={form.body} disabled={!editable} maxLength={20000} rows={8} onChange={(event) => setForm({ ...form, body: event.target.value })} />
          </Field>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Resources</p>
            {form.resources.map((resource, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                <Field label="Label"><TextInput value={resource.label} disabled={!editable} maxLength={120} placeholder="Dataset" onChange={(event) => setResource(index, { label: event.target.value })} /></Field>
                <Field label="Link" error={resource.url && !LINK.test(resource.url.trim()) ? "Use a full link starting with https://" : undefined}>
                  <TextInput type="url" value={resource.url} disabled={!editable} maxLength={500} placeholder="https://…" onChange={(event) => setResource(index, { url: event.target.value })} />
                </Field>
                {editable ? <Button onClick={() => setForm({ ...form, resources: form.resources.filter((_, position) => position !== index) })}>Remove</Button> : null}
              </div>
            ))}
            {editable && form.resources.length < 20 ? (
              <div><Button onClick={() => setForm({ ...form, resources: [...form.resources, { label: "", url: "" }] })}>Add resource</Button></div>
            ) : null}
          </div>
          {editable ? (
            <div className="flex flex-wrap gap-2">
              <Button tone="green" disabled={!dirty || !form.title.trim() || badLink || save.isPending} onClick={submit}>{save.isPending ? "Saving…" : "Save problem statement"}</Button>
              <ConfirmButton confirmLabel="Delete problem statement" disabled={remove.isPending}
                onConfirm={() => void notify(remove.mutateAsync(undefined), "Problem statement deleted.")}>Delete</ConfirmButton>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
