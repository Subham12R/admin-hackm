"use client"

import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { Badge, Button, ConfirmButton, Field, FieldAction, LoadingRows, Notice, PageHeader, Panel, StatusBadge, TextArea, TextInput } from "@/components/admin/kit"
import { ApiError, dateTime, errorMessage } from "@/lib/api"
import { toast } from "@/lib/notify"
import { can, keys, useAdminMutation, useAdminQuery, useMe } from "@/lib/queries"

type Resource = { label: string; url: string }
type Statement = { title: string; summary: string; body: string }
type Challenge = Statement & {
  resources: Resource[]
  version: number
  updated_at: string | null
  release_at: string | null
  released: boolean
}
type ChallengeUpdate = Statement & { resources: Resource[]; version: number }

const MAX_RESOURCES = 20
const LINK = /^https?:\/\/\S+$/

export default function ChallengePage() {
  const me = useMe()
  const editable = can.eventControl(me.data?.user.roles ?? [])
  const challenge = useAdminQuery<Challenge>(keys.challenge, "/api/admin/challenge")

  if (challenge.isError) return <Notice tone="red">{errorMessage(challenge.error, "The challenge could not be loaded.")}</Notice>
  if (!challenge.data) return <LoadingRows rows={6} />
  const server = challenge.data
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
      <StatementPanel server={server} editable={editable} />
      <ResourcesPanel server={server} editable={editable} />
    </div>
  )
}

/** Saves the whole challenge; on any failure the cached copy is refetched so a retry uses the latest version. */
function useSaveChallenge() {
  const client = useQueryClient()
  const mutation = useAdminMutation<ChallengeUpdate, Challenge>((body) => ({ path: "/api/admin/challenge", method: "PUT", body }), [["challenge"]])
  return {
    isPending: mutation.isPending,
    send: (body: ChallengeUpdate) => mutation.mutateAsync(body).catch(async (error: unknown) => {
      await client.invalidateQueries({ queryKey: keys.challenge })
      throw error
    }),
  }
}

function without<T>(record: Record<string, T>, key: string) {
  const { [key]: _removed, ...rest } = record // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest
}

function statementOf(challenge: Statement): Statement {
  return { title: challenge.title, summary: challenge.summary, body: challenge.body }
}

function sameStatement(a: Statement, b: Statement) {
  return a.title === b.title && a.summary === b.summary && a.body === b.body
}

/** Who sees a saved change, given the reveal state of the challenge. */
function audience(challenge: Challenge): string {
  if (challenge.released) return "Teams see it on their dashboard now."
  if (challenge.release_at) return `Teams will see it when the challenge is revealed (${dateTime(challenge.release_at)}).`
  return "Teams will see it once the challenge is revealed; set a reveal time in Event Control."
}

function toastFailure(error: unknown) {
  if (error instanceof ApiError && error.status === 409) toast.warning("Someone else changed the challenge. The page now shows their version; try again.")
  else toast.error(errorMessage(error))
}

function StatementPanel({ server, editable }: { server: Challenge; editable: boolean }) {
  const save = useSaveChallenge()
  // The draft exists only while editing; base is the server copy it started from, to spot edits by someone else.
  const [editing, setEditing] = useState<{ draft: Statement; base: Statement } | null>(null)
  const published = statementOf(server)
  const current = editing?.draft ?? published
  const dirty = editing !== null && !sameStatement(editing.draft, editing.base)
  const conflict = editing !== null && !sameStatement(editing.base, published)

  function edit(patch: Partial<Statement>) {
    setEditing((previous) => previous ? { ...previous, draft: { ...previous.draft, ...patch } } : { base: published, draft: { ...published, ...patch } })
  }

  function submit() {
    if (!editing) return
    save.send({ ...editing.draft, resources: server.resources, version: server.version })
      .then((saved) => {
        setEditing(null)
        toast.success(`Problem statement saved (version ${saved.version}).`, { description: audience(saved) })
      })
      .catch(toastFailure)
  }

  return (
    <Panel
      title="Problem statement"
      description={server.updated_at ? `Version ${server.version}, saved ${dateTime(server.updated_at)}` : "Not written yet"}
      actions={editable ? (
        <span className="flex flex-wrap items-center gap-2">
          {dirty ? <Badge tone="amber">unsaved changes</Badge> : null}
          {editing ? <Button disabled={save.isPending} onClick={() => setEditing(null)}>Discard changes</Button> : null}
          <Button tone="green" disabled={save.isPending || !dirty || conflict || !current.title.trim()} onClick={submit}>{save.isPending ? "Saving…" : "Save"}</Button>
        </span>
      ) : null}
    >
      <div className="grid gap-4">
        {conflict ? (
          <Notice tone="amber">
            Someone else saved the problem statement while you were editing.{" "}
            <button type="button" className="underline" onClick={() => setEditing(null)}>Load the latest version</button> (your edits here are discarded) before saving.
          </Notice>
        ) : null}
        <Field label="Title" error={editing && !current.title.trim() ? "A title is required" : undefined}>
          <TextInput value={current.title} disabled={!editable} maxLength={200} onChange={(event) => edit({ title: event.target.value })} />
        </Field>
        <Field label="One-line summary">
          <TextInput value={current.summary} disabled={!editable} maxLength={500} onChange={(event) => edit({ summary: event.target.value })} />
        </Field>
        <Field label="Full brief" hint="Plain text; line breaks are kept.">
          <TextArea value={current.body} disabled={!editable} maxLength={20000} rows={14} onChange={(event) => edit({ body: event.target.value })} />
        </Field>
      </div>
    </Panel>
  )
}

/** Stable identity for a published resource, so local edits follow it even if others are added before it. */
function identities(resources: Resource[]) {
  const seen = new Map<string, number>()
  return resources.map((resource) => {
    const base = `${resource.label}\u0000${resource.url}`
    const occurrence = seen.get(base) ?? 0
    seen.set(base, occurrence + 1)
    return `${base}#${occurrence}`
  })
}

function clean(resource: Resource): Resource {
  return { label: resource.label.trim(), url: resource.url.trim() }
}

function errorsOf(resource: Resource) {
  const label = resource.label.trim()
  const url = resource.url.trim()
  return {
    label: !label && url ? "Add a label" : "",
    url: url && !LINK.test(url) ? "Use a full link starting with https://" : "",
    valid: Boolean(label) && LINK.test(url),
  }
}

type Row = {
  key: string
  value: Resource
  published: Resource | null
  index: number | null
}

function ResourcesPanel({ server, editable }: { server: Challenge; editable: boolean }) {
  const save = useSaveChallenge()
  const [edits, setEdits] = useState<Record<string, Resource>>({})
  const [drafts, setDrafts] = useState<{ id: string; value: Resource }[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)

  const keysNow = identities(server.resources)
  const rows: Row[] = [
    ...server.resources.map((resource, index) => ({ key: keysNow[index], value: edits[keysNow[index]] ?? resource, published: resource, index })),
    ...drafts.map((draft) => ({ key: draft.id, value: draft.value, published: null, index: null })),
  ]

  function change(row: Row, patch: Partial<Resource>) {
    const value = { ...row.value, ...patch }
    if (row.published) setEdits((previous) => ({ ...previous, [row.key]: value }))
    else setDrafts((previous) => previous.map((draft) => draft.id === row.key ? { ...draft, value } : draft))
  }

  function discard(row: Row) {
    if (row.published) setEdits((previous) => without(previous, row.key))
    else setDrafts((previous) => previous.filter((draft) => draft.id !== row.key))
  }

  function add() {
    const id = `draft-${crypto.randomUUID()}`
    setDrafts((previous) => [...previous, { id, value: { label: "", url: "" } }])
    setFocusId(id)
  }

  function send(rowKey: string, resources: Resource[]) {
    setBusy(rowKey)
    return save.send({ ...statementOf(server), resources, version: server.version }).finally(() => setBusy(null))
  }

  function publish(row: Row) {
    const value = clean(row.value)
    const next = row.index === null ? [...server.resources, value] : server.resources.map((item, index) => index === row.index ? value : item)
    send(row.key, next)
      .then((saved) => {
        discard(row)
        toast.success(`Published “${value.label}”.`, { description: audience(saved) })
      })
      .catch(toastFailure)
  }

  function remove(row: Row) {
    if (row.index === null || !row.published) return
    const label = row.published.label
    send(row.key, server.resources.filter((_, index) => index !== row.index))
      .then(() => {
        discard(row)
        toast.success(`Removed “${label}”.`, { description: "Teams no longer see it." })
      })
      .catch(toastFailure)
  }

  const unpublished = drafts.length + Object.keys(edits).filter((key) => keysNow.includes(key)).length
  return (
    <Panel
      title="Resources"
      description="Links shown as cards on the participant dashboard (datasets, APIs, docs). Publish each one after adding or editing it."
      actions={editable ? (
        <span className="flex flex-wrap items-center gap-2">
          {unpublished ? <Badge tone="amber">{unpublished} unpublished</Badge> : null}
          <Button disabled={rows.length >= MAX_RESOURCES} onClick={add}>Add resource</Button>
        </span>
      ) : null}
    >
      <div className="grid gap-3">
        {rows.length ? rows.map((row) => {
          const errors = errorsOf(row.value)
          const changed = !row.published || clean(row.value).label !== row.published.label || clean(row.value).url !== row.published.url
          const status = !row.published ? <Badge tone="amber">draft</Badge> : changed ? <Badge tone="amber">unpublished changes</Badge> : <Badge tone="green">published</Badge>
          const pending = busy === row.key
          return (
            <div key={row.key} className="grid gap-2 rounded-lg border border-zinc-100 p-3">
              <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                {status}
                {row.published ? <a href={row.published.url} target="_blank" rel="noopener noreferrer" className="truncate underline">Open published link</a> : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-start">
                <Field label="Label" error={errors.label || undefined}>
                  <TextInput ref={row.key === focusId ? (element) => { element?.focus() } : undefined} value={row.value.label} disabled={!editable || pending} maxLength={120}
                    placeholder="Dataset, API docs…" onChange={(event) => change(row, { label: event.target.value })} />
                </Field>
                <Field label="Link" error={errors.url || undefined}>
                  <TextInput type="url" inputMode="url" value={row.value.url} disabled={!editable || pending} maxLength={500}
                    placeholder="https://…" onChange={(event) => change(row, { url: event.target.value })} />
                </Field>
                {editable ? (
                  <FieldAction>
                    <Button tone="green" disabled={!changed || !errors.valid || busy !== null} onClick={() => publish(row)}>{pending ? "Publishing…" : "Publish"}</Button>
                    {changed ? <Button disabled={pending} onClick={() => discard(row)}>{row.published ? "Discard" : "Cancel"}</Button> : null}
                    {row.published && !changed ? (
                      <ConfirmButton confirmLabel="Remove from dashboard" disabled={busy !== null} onConfirm={() => remove(row)}>Remove</ConfirmButton>
                    ) : null}
                  </FieldAction>
                ) : null}
              </div>
            </div>
          )
        }) : <p className="text-sm text-muted-foreground">No resources yet. Add one, then publish it.</p>}
        {rows.length >= MAX_RESOURCES ? <p className="text-xs text-muted-foreground">Up to {MAX_RESOURCES} resources.</p> : null}
      </div>
    </Panel>
  )
}
