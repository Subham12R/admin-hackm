"use client"

import { useState } from "react"

import { Badge, Button, ConfirmButton, Empty, Field, Notice, PageHeader, Panel, Select, StatusBadge, TextArea, TextInput } from "@/components/admin/kit"
import { Bones } from "@/components/admin/bones"
import { dateTime, errorMessage } from "@/lib/api"
import { can, keys, useAdminMutation, useAdminQuery, useMe } from "@/lib/queries"
import { notify } from "@/lib/notify"

type Announcement = {
  id: string
  title: string
  body: string
  level: "INFO" | "IMPORTANT" | "URGENT"
  status: "DRAFT" | "PUBLISHED"
  email_leaders: boolean
  emailed_at: string | null
  published_at: string | null
  created_at: string
  created_by: string | null
  reads: number
  audience: number
}

type Draft = { title: string; body: string; level: Announcement["level"]; email_leaders: boolean }
const EMPTY: Draft = { title: "", body: "", level: "INFO", email_leaders: false }
const AREA = [["announcements"]]

export default function AnnouncementsPage() {
  const me = useMe()
  const editable = can.eventControl(me.data?.user.roles ?? [])
  const list = useAdminQuery<{ items: Announcement[] }>(keys.announcements, "/api/admin/announcements", { refetchInterval: 60_000 })
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null)
  const create = useAdminMutation<Draft>((body) => ({ path: "/api/admin/announcements", body }), AREA)
  const update = useAdminMutation<{ id: string; draft: Draft }>(({ id, draft }) => ({ path: `/api/admin/announcements/${id}`, method: "PATCH", body: draft }), AREA)
  const publish = useAdminMutation<string>((id) => ({ path: `/api/admin/announcements/${id}/publish` }), AREA)
  const unpublish = useAdminMutation<string>((id) => ({ path: `/api/admin/announcements/${id}/unpublish` }), AREA)
  const remove = useAdminMutation<string>((id) => ({ path: `/api/admin/announcements/${id}`, method: "DELETE" }), AREA)

  function run(promise: Promise<unknown>, success: string, after?: () => void) {
    void notify(promise, success, after)
  }

  const items = list.data?.items ?? []
  const draft = editing?.draft
  const valid = Boolean(draft && draft.title.trim() && draft.body.trim())

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader
        title="Announcements"
        description="Published announcements appear as notifications on every paid team's dashboard."
        actions={editable && !editing ? <Button tone="green" onClick={() => setEditing({ id: null, draft: EMPTY })}>New announcement</Button> : null}
      />
      {editing && draft ? (
        <Panel title={editing.id ? "Edit announcement" : "New announcement"} description="Saved as a draft. Publishing makes it visible to teams.">
          <div className="grid gap-3">
            <Field label="Title"><TextInput value={draft.title} maxLength={200} onChange={(event) => setEditing({ ...editing, draft: { ...draft, title: event.target.value } })} /></Field>
            <Field label="Message" hint={`${draft.body.length}/5000`}><TextArea value={draft.body} maxLength={5000} rows={6} onChange={(event) => setEditing({ ...editing, draft: { ...draft, body: event.target.value } })} /></Field>
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Priority">
                <Select value={draft.level} onChange={(event) => setEditing({ ...editing, draft: { ...draft, level: event.target.value as Draft["level"] } })}>
                  <option value="INFO">Info</option>
                  <option value="IMPORTANT">Important</option>
                  <option value="URGENT">Urgent</option>
                </Select>
              </Field>
              <label className="flex items-center gap-2 pb-1 text-sm">
                <input type="checkbox" checked={draft.email_leaders} onChange={(event) => setEditing({ ...editing, draft: { ...draft, email_leaders: event.target.checked } })} />
                Also email every paid team leader when published (sent once)
              </label>
            </div>
            <div className="flex gap-2">
              <Button tone="green" disabled={!valid || create.isPending || update.isPending}
                onClick={() => run(editing.id ? update.mutateAsync({ id: editing.id, draft }) : create.mutateAsync(draft), "Draft saved.", () => setEditing(null))}>
                Save draft
              </Button>
              <Button onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        </Panel>
      ) : null}
      <Panel title="All announcements" description={`${items.filter((item) => item.status === "PUBLISHED").length} published, ${items.filter((item) => item.status === "DRAFT").length} drafts`}>
        {list.isError ? <Notice tone="red">{errorMessage(list.error, "Announcements could not be loaded.")}</Notice> : null}
        <Bones name="announcements" loading={list.isPending}>
        {items.length ? (
          <ul className="admin-stagger divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 max-w-3xl">
                  <p className="flex flex-wrap items-center gap-1.5 font-medium">
                    {item.title} <StatusBadge status={item.status} />
                    {item.level !== "INFO" ? <Badge tone={item.level === "URGENT" ? "red" : "amber"}>{item.level.toLowerCase()}</Badge> : null}
                    {item.emailed_at ? <Badge tone="blue">emailed</Badge> : item.email_leaders ? <Badge>will email</Badge> : null}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">{item.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.published_at ? `Published ${dateTime(item.published_at)} · read by ${item.reads} of ${item.audience} teams` : `Drafted ${dateTime(item.created_at)}`}
                    {item.created_by ? ` · by ${item.created_by}` : ""}
                  </p>
                </div>
                {editable ? (
                  <div className="flex flex-wrap gap-1">
                    <Button onClick={() => setEditing({ id: item.id, draft: { title: item.title, body: item.body, level: item.level, email_leaders: item.email_leaders } })}>Edit</Button>
                    {item.status === "DRAFT" ? (
                      <ConfirmButton tone="green" confirmLabel={item.email_leaders && !item.emailed_at ? "Publish and email" : "Publish now"} disabled={publish.isPending}
                        onConfirm={() => run(publish.mutateAsync(item.id), "Published to all teams.")}>
                        Publish
                      </ConfirmButton>
                    ) : (
                      <ConfirmButton confirmLabel="Hide from teams" disabled={unpublish.isPending} onConfirm={() => run(unpublish.mutateAsync(item.id), "Announcement hidden.")}>Unpublish</ConfirmButton>
                    )}
                    {!item.published_at ? <ConfirmButton confirmLabel="Delete draft" disabled={remove.isPending} onConfirm={() => run(remove.mutateAsync(item.id), "Draft deleted.")}>Delete</ConfirmButton> : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : <Empty>No announcements yet.</Empty>}
        </Bones>
      </Panel>
    </div>
  )
}
