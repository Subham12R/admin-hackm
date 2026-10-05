"use client"

import { useState } from "react"

import { Button, Field, LoadingRows, Notice, PageHeader, Panel, StatusBadge, TextInput } from "@/components/admin/kit"
import { dateTime, errorMessage, fromLocalInput, toLocalInput } from "@/lib/api"
import { can, keys, useAdminMutation, useAdminQuery, useMe } from "@/lib/queries"

type Window = { opens_at: string | null; closes_at: string | null; state: "OPEN" | "NOT_OPEN" | "CLOSED" }
export type EventConfig = {
  name: string
  timezone: string
  now: string
  starts_at: string | null
  ends_at: string | null
  registration: Window
  submission: Window
  challenge: { release_at: string | null; released: boolean }
  updated_at: string | null
  updated_by: string | null
}

const FIELDS = [
  ["starts_at", "Hackathon starts"],
  ["ends_at", "Hackathon ends"],
  ["registration_opens_at", "Registration opens"],
  ["registration_closes_at", "Registration closes"],
  ["submission_opens_at", "Submissions open"],
  ["submission_closes_at", "Submissions close"],
  ["challenge_release_at", "Problem statement reveal"],
] as const

type FieldKey = (typeof FIELDS)[number][0]

function fromConfig(config: EventConfig): Record<FieldKey, string> {
  return {
    starts_at: toLocalInput(config.starts_at),
    ends_at: toLocalInput(config.ends_at),
    registration_opens_at: toLocalInput(config.registration.opens_at),
    registration_closes_at: toLocalInput(config.registration.closes_at),
    submission_opens_at: toLocalInput(config.submission.opens_at),
    submission_closes_at: toLocalInput(config.submission.closes_at),
    challenge_release_at: toLocalInput(config.challenge.release_at),
  }
}

export default function EventControlPage() {
  const me = useMe()
  const editable = can.eventControl(me.data?.user.roles ?? [])
  const event = useAdminQuery<EventConfig>(keys.event, "/api/admin/event", { refetchInterval: 60_000 })
  const [generation, setGeneration] = useState(0)

  if (event.isError) return <Notice tone="red">{errorMessage(event.error, "Event settings could not be loaded.")}</Notice>
  if (!event.data) return <LoadingRows rows={6} />
  // Background refetches update the status cards; the form keeps unsaved edits until it is saved.
  return <ScheduleEditor key={generation} config={event.data} editable={editable} saved={() => setGeneration((value) => value + 1)} />
}

function ScheduleEditor({ config, editable, saved }: { config: EventConfig; editable: boolean; saved: () => void }) {
  const save = useAdminMutation<Partial<Record<FieldKey | "name", string | null>>>((body) => ({ path: "/api/admin/event", method: "PATCH", body }), [["event"], ["challenge"]])
  const [initial] = useState(() => fromConfig(config))
  const [form, setForm] = useState(initial)
  const [name, setName] = useState(config.name)
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string } | null>(null)
  const changed = FIELDS.filter(([key]) => form[key] !== initial[key])

  function submit() {
    const body: Partial<Record<FieldKey | "name", string | null>> = {}
    for (const [key] of changed) body[key] = fromLocalInput(form[key])
    if (name.trim() && name.trim() !== config.name) body.name = name.trim()
    setMessage(null)
    save.mutateAsync(body)
      .then(() => saved())
      .catch((error) => setMessage({ tone: "red", text: errorMessage(error) }))
  }

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader title="Event Control" description="Times the server enforces for registration, submissions, and the problem statement. All times are IST." />
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Registration" description={windowText(config.registration)}><StatusBadge status={config.registration.state} /></Panel>
        <Panel title="Submissions" description={windowText(config.submission)}><StatusBadge status={config.submission.state} /></Panel>
        <Panel title="Problem statement" description={config.challenge.release_at ? `Reveals ${dateTime(config.challenge.release_at)}` : "No reveal time set; it stays hidden."}>
          <StatusBadge status={config.challenge.released ? "RELEASED" : "LOCKED"} label={config.challenge.released ? "revealed" : "hidden"} />
        </Panel>
      </div>
      <Panel
        title="Schedule"
        description={config.updated_by ? `Last changed by ${config.updated_by} on ${dateTime(config.updated_at)}` : "Leave a time empty to remove that limit."}
        actions={editable ? <Button tone="green" disabled={save.isPending || (!changed.length && name.trim() === config.name)} onClick={submit}>{save.isPending ? "Saving…" : "Save changes"}</Button> : null}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (editable) submit() }}>
          <Field label="Event name">
            <TextInput value={name} disabled={!editable} maxLength={200} onChange={(event) => setName(event.target.value)} />
          </Field>
          <div />
          {FIELDS.map(([key, label]) => (
            <Field key={key} label={`${label} (IST)`} hint={form[key] !== initial[key] ? "Unsaved change" : undefined}>
              <span className="flex gap-1">
                <TextInput type="datetime-local" disabled={!editable} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="flex-1" />
                {editable && form[key] ? <Button onClick={() => setForm({ ...form, [key]: "" })} aria-label={`Clear ${label}`}>Clear</Button> : null}
              </span>
            </Field>
          ))}
        </form>
        {!editable ? <p className="mt-3 text-xs text-muted-foreground">Only event admins can change the schedule.</p> : null}
      </Panel>
    </div>
  )
}

function windowText(window: Window) {
  const opens = window.opens_at ? `opens ${dateTime(window.opens_at)}` : "no opening limit"
  const closes = window.closes_at ? `closes ${dateTime(window.closes_at)}` : "no closing limit"
  return `${opens}, ${closes}`
}
