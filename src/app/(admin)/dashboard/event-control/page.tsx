"use client"

import Link from "next/link"
import { useState } from "react"

import { Button, ConfirmButton, Field, Notice, PageHeader, Panel, StatusBadge, TextInput } from "@/components/admin/kit"
import { Bones } from "@/components/admin/bones"
import { dateTime, errorMessage, fromLocalInput, toLocalInput } from "@/lib/api"
import { can, keys, useAdminMutation, useAdminQuery, useMe } from "@/lib/queries"
import { notify } from "@/lib/notify"

type Window = { opens_at: string | null; closes_at: string | null; state: "OPEN" | "NOT_OPEN" | "CLOSED" }
export type EventConfig = {
  name: string
  timezone: string
  now: string
  starts_at: string | null
  ends_at: string | null
  registration: Window & { enabled?: boolean }
  submission: Window
  challenge: { release_at: string | null; released: boolean }
  stage?: { id: string; name: string } | null
  updated_at: string | null
  updated_by: string | null
}

const FIELDS = [
  ["starts_at", "Hackathon starts"],
  ["ends_at", "Hackathon ends"],
  ["registration_opens_at", "Registration opens"],
  ["registration_closes_at", "Registration closes"],
] as const

type FieldKey = (typeof FIELDS)[number][0]

function fromConfig(config: EventConfig): Record<FieldKey, string> {
  return {
    starts_at: toLocalInput(config.starts_at),
    ends_at: toLocalInput(config.ends_at),
    registration_opens_at: toLocalInput(config.registration.opens_at),
    registration_closes_at: toLocalInput(config.registration.closes_at),
  }
}

export default function EventControlPage() {
  const me = useMe()
  const editable = can.eventControl(me.data?.user.roles ?? [])
  const event = useAdminQuery<EventConfig>(keys.event, "/api/admin/event", { refetchInterval: 60_000 })
  const [generation, setGeneration] = useState(0)

  if (event.isError) return <Notice tone="red">{errorMessage(event.error, "Event settings could not be loaded.")}</Notice>
  // Background refetches update the status cards; the form keeps unsaved edits until it is saved.
  return (
    <Bones name="event-control" loading={!event.data}>
      {event.data ? <ScheduleEditor key={generation} config={event.data} editable={editable} saved={() => setGeneration((value) => value + 1)} /> : null}
    </Bones>
  )
}

function ScheduleEditor({ config, editable, saved }: { config: EventConfig; editable: boolean; saved: () => void }) {
  const save = useAdminMutation<Partial<Record<FieldKey | "name", string | null>>>((body) => ({ path: "/api/admin/event", method: "PATCH", body }), [["event"], ["stages"]])
  const toggle = useAdminMutation<boolean>((enabled) => ({ path: "/api/admin/event", method: "PATCH", body: { registration_enabled: enabled } }), [["event"]])
  const registrationOn = config.registration.enabled !== false
  const [initial] = useState(() => fromConfig(config))
  const [form, setForm] = useState(initial)
  const [name, setName] = useState(config.name)
  const changed = FIELDS.filter(([key]) => form[key] !== initial[key])

  function submit() {
    const body: Partial<Record<FieldKey | "name", string | null>> = {}
    for (const [key] of changed) body[key] = fromLocalInput(form[key])
    if (name.trim() && name.trim() !== config.name) body.name = name.trim()
    void notify(save.mutateAsync(body), "Schedule saved. The server enforces the new times now.", saved)
  }

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader title="Event Control" description="Hackathon dates and the registration window the server enforces. Submission times and problem statements are set per event on the Events page. All times are IST." />
      <div className="grid gap-4 md:grid-cols-3">
        <Panel
          title="Registration"
          description={registrationOn ? windowText(config.registration) : "Switched off: the landing page shows registrations closed and new teams are refused."}
          actions={editable ? (
            registrationOn ? (
              <ConfirmButton confirmLabel="Close registration" disabled={toggle.isPending}
                onConfirm={() => void notify(toggle.mutateAsync(false), "Registration closed. The landing page now shows it as closed.")}>
                Turn off
              </ConfirmButton>
            ) : (
              <Button tone="green" disabled={toggle.isPending}
                onClick={() => void notify(toggle.mutateAsync(true), "Registration switched on. The dates above still apply.")}>
                Turn on
              </Button>
            )
          ) : null}
        >
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={config.registration.state} />
            {!registrationOn ? <StatusBadge status="DISABLED" label="switched off" /> : null}
          </span>
        </Panel>
        <Panel title={`Submissions${config.stage ? ` · ${config.stage.name}` : ""}`} description={windowText(config.submission)}><StatusBadge status={config.submission.state} /></Panel>
        <Panel title="Events" description="Submission windows, problem statements and winners for each event.">
          <Link href="/dashboard/events" className="text-sm underline">Manage events</Link>
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
