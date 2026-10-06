"use client"

import Link from "next/link"
import { useState } from "react"

import { Button, Field, LoadingRows, Notice, PageHeader, Panel, StatusBadge, TextArea, TextInput } from "@/components/admin/kit"
import { dateTime, errorMessage } from "@/lib/api"
import { can, keys, useAdminMutation, useAdminQuery, useMe } from "@/lib/queries"

type Resource = { label: string; url: string }
type Challenge = {
  title: string
  summary: string
  body: string
  resources: Resource[]
  version: number
  updated_at: string | null
  release_at: string | null
  released: boolean
}

export default function ChallengePage() {
  const me = useMe()
  const editable = can.eventControl(me.data?.user.roles ?? [])
  const challenge = useAdminQuery<Challenge>(keys.challenge, "/api/admin/challenge")
  // Bumped after a save or an explicit reload; remounts the editor from the server copy.
  const [generation, setGeneration] = useState(0)

  if (challenge.isError) return <Notice tone="red">{errorMessage(challenge.error, "The challenge could not be loaded.")}</Notice>
  if (!challenge.data) return <LoadingRows rows={6} />
  return <ChallengeEditor key={generation} server={challenge.data} editable={editable} reload={() => setGeneration((value) => value + 1)} />
}

function ChallengeEditor({ server, editable, reload }: { server: Challenge; editable: boolean; reload: () => void }) {
  const save = useAdminMutation<Omit<Challenge, "updated_at" | "release_at" | "released">>((body) => ({ path: "/api/admin/challenge", method: "PUT", body }), [["challenge"]])
  const [draft, setDraft] = useState<Challenge>(server)
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string } | null>(null)
  const stale = server.version !== draft.version
  const validResources = draft.resources.every((resource) => resource.label.trim() && /^https?:\/\/\S+$/.test(resource.url.trim()))

  function submit() {
    setMessage(null)
    save.mutateAsync({
      title: draft.title, summary: draft.summary, body: draft.body, version: draft.version,
      resources: draft.resources.map((resource) => ({ label: resource.label.trim(), url: resource.url.trim() })),
    })
      .then(() => reload())
      .catch((error) => setMessage({ tone: "red", text: errorMessage(error) }))
  }
  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader
        title="Challenge"
        description="The problem statement teams see on their dashboard. It stays hidden until the reveal time in Event Control."
        actions={
          <span className="flex items-center gap-2 text-sm">
            <StatusBadge status={server.released ? "RELEASED" : "LOCKED"} label={server.released ? "revealed" : "hidden"} />
            {server.release_at ? `reveal ${dateTime(server.release_at)}` : <Link href="/dashboard/event-control" className="underline">set a reveal time</Link>}
          </span>
        }
      />
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {stale ? <Notice tone="amber">Someone else saved a newer version. Reload to see it before saving: <button type="button" className="underline" onClick={reload}>reload</button></Notice> : null}
      <Panel
        title="Problem statement"
        description={server.updated_at ? `Version ${server.version}, saved ${dateTime(server.updated_at)}` : "Not written yet"}
        actions={editable ? <Button tone="green" disabled={save.isPending || !draft.title.trim() || !validResources} onClick={submit}>{save.isPending ? "Saving…" : "Save"}</Button> : null}
      >
        <div className="grid gap-4">
          <Field label="Title">
            <TextInput value={draft.title} disabled={!editable} maxLength={200} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </Field>
          <Field label="One-line summary">
            <TextInput value={draft.summary} disabled={!editable} maxLength={500} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} />
          </Field>
          <Field label="Full brief" hint="Plain text; line breaks are kept.">
            <TextArea value={draft.body} disabled={!editable} maxLength={20000} rows={14} onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
          </Field>
        </div>
      </Panel>
      <Panel
        title="Resources"
        description="Links shown as cards on the participant dashboard (datasets, APIs, docs)."
        actions={editable && draft.resources.length < 20 ? <Button onClick={() => setDraft({ ...draft, resources: [...draft.resources, { label: "", url: "" }] })}>Add resource</Button> : null}
      >
        <div className="grid gap-2">
          {draft.resources.length ? draft.resources.map((resource, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <Field label="Label">
                <TextInput value={resource.label} disabled={!editable} maxLength={120} onChange={(event) => setDraft({ ...draft, resources: draft.resources.map((item, position) => position === index ? { ...item, label: event.target.value } : item) })} />
              </Field>
              <Field label="Link (https://…)">
                <TextInput value={resource.url} disabled={!editable} maxLength={500} onChange={(event) => setDraft({ ...draft, resources: draft.resources.map((item, position) => position === index ? { ...item, url: event.target.value } : item) })} />
              </Field>
              {editable ? <Button onClick={() => setDraft({ ...draft, resources: draft.resources.filter((_, position) => position !== index) })}>Remove</Button> : null}
            </div>
          )) : <p className="text-sm text-muted-foreground">No resources yet.</p>}
          {!validResources ? <p className="text-xs text-red-600">Every resource needs a label and a full http(s) link.</p> : null}
        </div>
      </Panel>
    </div>
  )
}
