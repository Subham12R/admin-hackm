"use client"

import { ArrowDown, ArrowUp, X } from "lucide-react"
import { useState } from "react"

import { Badge, Button, ConfirmButton, Empty, Field, LoadingRows, Notice, PageHeader, Panel, Select, StatusBadge, TextInput } from "@/components/admin/kit"
import { dateTime, errorMessage, fromLocalInput, toLocalInput } from "@/lib/api"
import { notify } from "@/lib/notify"
import { can, keys, useAdminMutation, useAdminQuery, useMe } from "@/lib/queries"

type Importance = "INFO" | "IMPORTANT" | "URGENT"
type SiteNotice = {
  id: string
  message: string
  link_url: string
  link_label: string
  importance: Importance
  position: number
  active: boolean
  starts_at: string | null
  ends_at: string | null
  state: "HIDDEN" | "SCHEDULED" | "LIVE" | "ENDED"
  updated_at: string
  updated_by: string | null
}
type LiveItem = Pick<SiteNotice, "id" | "message" | "link_url" | "link_label" | "importance">
type Listing = { items: SiteNotice[]; live: { version: string; items: LiveItem[] } }
type Draft = { message: string; link_url: string; link_label: string; importance: Importance; active: boolean; starts: string; ends: string }

const EMPTY: Draft = { message: "", link_url: "", link_label: "", importance: "INFO", active: true, starts: "", ends: "" }
const AREA = [keys.siteNotices]
const IMPORTANCE: Record<Importance, { label: string; help: string; tone: "zinc" | "amber" | "red"; strip: string; dot: string }> = {
  INFO: { label: "Info", help: "General news", tone: "zinc", strip: "bg-[#3f1a12] text-[#faf6f1]", dot: "bg-[#fde68a]" },
  IMPORTANT: { label: "Important", help: "Deadlines, changes", tone: "amber", strip: "bg-amber-400 text-amber-950", dot: "bg-amber-900" },
  URGENT: { label: "Urgent", help: "Act now; shown first", tone: "red", strip: "bg-red-600 text-white", dot: "bg-white" },
}
const STATE_LABEL: Record<SiteNotice["state"], string> = { HIDDEN: "hidden", SCHEDULED: "scheduled", LIVE: "live", ENDED: "ended" }
const LINK = /^(\/(?!\/)\S*|https?:\/\/\S+)$/

function draftOf(notice: SiteNotice): Draft {
  return {
    message: notice.message, link_url: notice.link_url, link_label: notice.link_label, importance: notice.importance,
    active: notice.active, starts: toLocalInput(notice.starts_at), ends: toLocalInput(notice.ends_at),
  }
}

function bodyOf(draft: Draft) {
  return {
    message: draft.message.trim(), link_url: draft.link_url.trim(), link_label: draft.link_label.trim(), importance: draft.importance,
    active: draft.active, starts_at: fromLocalInput(draft.starts), ends_at: fromLocalInput(draft.ends),
  }
}

export default function SiteStripPage() {
  const me = useMe()
  const editable = can.eventControl(me.data?.user.roles ?? [])
  const list = useAdminQuery<Listing>(keys.siteNotices, "/api/admin/site-notices", { refetchInterval: 60_000 })
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null)
  const create = useAdminMutation<ReturnType<typeof bodyOf>>((body) => ({ path: "/api/admin/site-notices", body }), AREA)
  const update = useAdminMutation<{ id: string; body: Record<string, unknown> }>(({ id, body }) => ({ path: `/api/admin/site-notices/${id}`, method: "PATCH", body }), AREA)
  const reorder = useAdminMutation<string[]>((ids) => ({ path: "/api/admin/site-notices/order", body: { ids } }), AREA)
  const remove = useAdminMutation<string>((id) => ({ path: `/api/admin/site-notices/${id}`, method: "DELETE" }), AREA)

  const items = list.data?.items ?? []
  const draft = editing?.draft
  const linkError = draft && draft.link_url.trim() && !LINK.test(draft.link_url.trim()) ? "Use a full https:// link or a site path like /register" : ""
  const windowError = draft && draft.starts && draft.ends && draft.starts >= draft.ends ? "The end must be after the start" : ""
  const valid = Boolean(draft && draft.message.trim() && !linkError && !windowError)
  const pending = create.isPending || update.isPending

  function save() {
    if (!editing || !draft) return
    const body = bodyOf(draft)
    const live = draft.active ? "It shows on the site within a minute." : "It stays hidden until you show it."
    if (editing.id) void notify(update.mutateAsync({ id: editing.id, body }), `Notice saved. ${live}`, () => setEditing(null))
    else void notify(create.mutateAsync(body), `Notice added. ${live}`, () => setEditing(null))
  }

  function move(index: number, by: number) {
    const ids = items.map((item) => item.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + by, 0, moved)
    void notify(reorder.mutateAsync(ids), "Order saved.")
  }

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader
        title="Site strip"
        description="A single scrolling row above the public site's menu. Urgent notices come first and set its colour. Visitors can close it; it comes back when you add or change a live notice."
        actions={editable && !editing ? <Button tone="green" onClick={() => setEditing({ id: null, draft: EMPTY })}>New notice</Button> : null}
      />

      <Panel title="Preview" description={list.data?.live.items.length ? "What visitors see right now." : "Nothing is live, so the strip is hidden on the site."}>
        <StripPreview items={list.data?.live.items ?? []} />
      </Panel>

      {editing && draft ? (
        <Panel title={editing.id ? "Edit notice" : "New notice"} description="Keep it short: one line that still reads well while it scrolls.">
          <div className="grid gap-3">
            <Field label="Message" hint={`${draft.message.length}/200`}>
              <TextInput value={draft.message} maxLength={200} placeholder="Registrations close Friday, 11:59 pm" onChange={(event) => setEditing({ ...editing, draft: { ...draft, message: event.target.value } })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr] sm:items-start">
              <Field label="Link (optional)" error={linkError || undefined} hint={linkError ? undefined : "A full link or a site path, e.g. /register"}>
                <TextInput value={draft.link_url} maxLength={500} placeholder="/register" onChange={(event) => setEditing({ ...editing, draft: { ...draft, link_url: event.target.value } })} />
              </Field>
              <Field label="Link text" hint="Default: Learn more">
                <TextInput value={draft.link_label} maxLength={40} placeholder="Register" onChange={(event) => setEditing({ ...editing, draft: { ...draft, link_label: event.target.value } })} />
              </Field>
              <Field label="Importance" hint={IMPORTANCE[draft.importance].help}>
                <Select value={draft.importance} onChange={(event) => setEditing({ ...editing, draft: { ...draft, importance: event.target.value as Importance } })}>
                  {(Object.keys(IMPORTANCE) as Importance[]).map((level) => <option key={level} value={level}>{IMPORTANCE[level].label}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
              <Field label="Show from (IST, optional)" hint="Empty = as soon as it is shown">
                <TextInput type="datetime-local" value={draft.starts} onChange={(event) => setEditing({ ...editing, draft: { ...draft, starts: event.target.value } })} />
              </Field>
              <Field label="Show until (IST, optional)" error={windowError || undefined} hint={windowError ? undefined : "Empty = until you hide it"}>
                <TextInput type="datetime-local" value={draft.ends} onChange={(event) => setEditing({ ...editing, draft: { ...draft, ends: event.target.value } })} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.active} onChange={(event) => setEditing({ ...editing, draft: { ...draft, active: event.target.checked } })} />
              Show on the site
            </label>
            <div className="flex flex-wrap gap-2">
              <Button tone="green" disabled={!valid || pending} onClick={save}>{pending ? "Saving…" : editing.id ? "Save notice" : "Add notice"}</Button>
              <Button onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel title="All notices" description="The order here is used within each importance level.">
        {list.isError ? <Notice tone="red">{errorMessage(list.error, "Notices could not be loaded.")}</Notice> : list.isPending ? <LoadingRows rows={3} /> : items.length ? (
          <ul className="divide-y divide-border">
            {items.map((item, index) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{item.message}</span>
                    <StatusBadge status={item.state === "LIVE" ? "ACTIVE" : item.state === "SCHEDULED" ? "PENDING" : "CLOSED"} label={STATE_LABEL[item.state]} />
                    <Badge tone={IMPORTANCE[item.importance].tone}>{IMPORTANCE[item.importance].label.toLowerCase()}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.link_url ? `${item.link_label || "Learn more"} → ${item.link_url} · ` : ""}
                    {item.starts_at ? `from ${dateTime(item.starts_at)} ` : ""}{item.ends_at ? `until ${dateTime(item.ends_at)} · ` : item.starts_at ? "· " : ""}
                    updated {dateTime(item.updated_at)}{item.updated_by ? ` by ${item.updated_by}` : ""}
                  </p>
                </div>
                {editable ? (
                  <span className="flex flex-wrap items-center gap-1">
                    <Button aria-label={`Move "${item.message}" up`} disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)}><ArrowUp className="size-3.5" /></Button>
                    <Button aria-label={`Move "${item.message}" down`} disabled={index === items.length - 1 || reorder.isPending} onClick={() => move(index, 1)}><ArrowDown className="size-3.5" /></Button>
                    <Button tone={item.active ? "zinc" : "green"} disabled={update.isPending}
                      onClick={() => void notify(update.mutateAsync({ id: item.id, body: { active: !item.active } }), item.active ? "Notice hidden from the site." : "Notice shown on the site.")}>
                      {item.active ? "Hide" : "Show"}
                    </Button>
                    <Button onClick={() => setEditing({ id: item.id, draft: draftOf(item) })}>Edit</Button>
                    <ConfirmButton confirmLabel="Delete notice" disabled={remove.isPending} onConfirm={() => void notify(remove.mutateAsync(item.id), "Notice deleted.")}>Delete</ConfirmButton>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : <Empty>No notices yet.</Empty>}
      </Panel>
    </div>
  )
}

/** A still copy of the public strip: same colours and order, without the scrolling. */
function StripPreview({ items }: { items: LiveItem[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">Hidden: no live notices.</p>
  const top = items[0].importance
  return (
    <div className={`flex h-8 items-center gap-6 overflow-hidden rounded-md px-3 text-xs ${IMPORTANCE[top].strip}`} aria-label="Strip preview">
      <div className="flex min-w-0 flex-1 items-center gap-6 overflow-hidden whitespace-nowrap">
        {items.map((item) => (
          <span key={item.id} className="flex items-center gap-2">
            <span className={`size-1.5 rounded-full ${IMPORTANCE[item.importance].dot}`} aria-hidden="true" />
            {item.message}
            {item.link_url ? <span className="underline underline-offset-2">{item.link_label || "Learn more"}</span> : null}
          </span>
        ))}
      </div>
      <X className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
    </div>
  )
}
