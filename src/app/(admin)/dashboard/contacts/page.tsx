"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"

import { Badge, Button, Empty, Field, LoadingRows, Notice, PageHeader, Panel, Select, StatusBadge, TextArea } from "@/components/admin/kit"
import { Bones } from "@/components/admin/bones"
import { api, dateTime, errorMessage } from "@/lib/api"
import { can, keys, useAdminMutation, useAdminQuery, useMe } from "@/lib/queries"
import { notify } from "@/lib/notify"

type Contact = { id: string; name: string; email: string; subject: string; preview: string; status: string; assigned_to: string | null; created_at: string; updated_at: string }
type ContactDetail = Contact & { message: string; thread: { id: string; kind: "REPLY" | "NOTE"; body: string; author: string | null; created_at: string }[] }
type ContactPage = { items: Contact[]; total: number; page: number; page_size: number; counts: Record<string, number> }
type Staff = { staff: { email: string; display_name: string; status: string }[] }

const FILTERS = [["ACTIVE", "Open inbox"], ["NEW", "New"], ["OPEN", "In progress"], ["RESOLVED", "Resolved"], ["SPAM", "Spam"]] as const
const AREA = [["contacts"], ["contact"]]

export default function ContactsPage() {
  const me = useMe()
  const roles = me.data?.user.roles ?? []
  const [status, setStatus] = useState<string>("ACTIVE")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const params = new URLSearchParams({ status, page: String(page), page_size: "20" }).toString()
  const list = useQuery({
    queryKey: keys.contacts(params),
    queryFn: ({ signal }) => api<ContactPage>(`/api/admin/contacts?${params}`, { signal }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
  const items = list.data?.items ?? []
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 20))

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader title="Contacts" description="Messages from the public contact form. Replies are emailed to the sender; notes stay internal." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel
          title="Inbox"
          description={list.data ? `${list.data.counts.NEW ?? 0} new · ${list.data.counts.OPEN ?? 0} in progress · ${list.data.counts.RESOLVED ?? 0} resolved` : undefined}
          actions={
            <Select value={status} aria-label="Filter messages" onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
              {FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          }
        >
          {list.isError ? <Notice tone="red">{errorMessage(list.error, "Messages could not be loaded.")}</Notice> : null}
          <Bones name="contacts-inbox" loading={list.isPending}>
          {items.length ? (
            <ul className="admin-stagger divide-y divide-zinc-100">
              {items.map((item) => (
                <li key={item.id}>
                  {/* A div, not a button: boneyard captures buttons as one solid block. */}
                  <div role="button" tabIndex={0} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(item.id) } }}
                    className={`w-full cursor-pointer rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 ${selected === item.id ? "bg-zinc-100" : ""}`}>
                    <p className="flex items-center justify-between gap-2 text-sm font-medium">
                      <span className="truncate">{item.subject}</span><StatusBadge status={item.status} />
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{item.name} · {item.email} · {dateTime(item.created_at)}</p>
                    <p className="truncate text-xs text-zinc-600">{item.preview}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty>No messages here.</Empty>}
          </Bones>
          {pages > 1 ? (
            <div className="mt-3 flex items-center justify-between text-sm">
              <Button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span>Page {page} of {pages}</span>
              <Button disabled={page === pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          ) : null}
        </Panel>
        {selected ? <Thread id={selected} canAct={can.support(roles)} canSeeStaff={can.superAdmin(roles)} /> : <Panel><Empty>Select a message to read it.</Empty></Panel>}
      </div>
    </div>
  )
}

function Thread({ id, canAct, canSeeStaff }: { id: string; canAct: boolean; canSeeStaff: boolean }) {
  const detail = useAdminQuery<ContactDetail>(keys.contact(id), `/api/admin/contacts/${id}`)
  const staff = useAdminQuery<Staff>(keys.staff, canSeeStaff ? "/api/admin/staff" : null)
  const update = useAdminMutation<{ status?: string; assignee_email?: string }>((body) => ({ path: `/api/admin/contacts/${id}`, method: "PATCH", body }), AREA)
  const reply = useAdminMutation<{ kind: "REPLY" | "NOTE"; body: string }>((body) => ({ path: `/api/admin/contacts/${id}/replies`, body }), AREA)
  const [text, setText] = useState("")
  const top = useRef<HTMLDivElement>(null)

  // Below xl the thread stacks under the inbox, so bring the opened message into view.
  useEffect(() => {
    if (window.innerWidth < 1280) top.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [id])

  function run(promise: Promise<unknown>, success: string, after?: () => void) {
    void notify(promise, success, after)
  }

  const data = detail.data
  if (detail.isError) return <Panel><Notice tone="red">{errorMessage(detail.error, "Message could not be loaded.")}</Notice></Panel>
  if (!data) return <div ref={top} className="scroll-mt-16"><Panel><LoadingRows rows={6} /></Panel></div>
  return (
    <div ref={top} className="scroll-mt-16">
    <Panel
      title={data.subject}
      description={`${data.name} <${data.email}> · ${dateTime(data.created_at)}${data.assigned_to ? ` · assigned to ${data.assigned_to}` : ""}`}
      actions={canAct ? (
        <span className="flex flex-wrap gap-1">
          <Select value={data.status} aria-label="Status" disabled={update.isPending} onChange={(event) => run(update.mutateAsync({ status: event.target.value }), "Status updated.")}>
            <option value="NEW">New</option><option value="OPEN">In progress</option><option value="RESOLVED">Resolved</option><option value="SPAM">Spam</option>
          </Select>
          {staff.data ? (
            <Select value="" aria-label="Assign" disabled={update.isPending} onChange={(event) => { if (event.target.value) run(update.mutateAsync({ assignee_email: event.target.value === "-" ? "" : event.target.value }), "Assignment updated.") }}>
              <option value="">Assign…</option>
              <option value="-">Unassigned</option>
              {staff.data.staff.filter((user) => user.status === "ACTIVE").map((user) => <option key={user.email} value={user.email}>{user.display_name}</option>)}
            </Select>
          ) : null}
        </span>
      ) : null}
    >
      <p className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm">{data.message}</p>
      <ul className="admin-stagger mt-3 space-y-2">
        {data.thread.map((entry) => (
          <li key={entry.id} className={`rounded-lg p-3 text-sm ${entry.kind === "NOTE" ? "bg-amber-50" : "bg-sky-50"}`}>
            <p className="mb-1 text-xs text-muted-foreground"><Badge tone={entry.kind === "NOTE" ? "amber" : "blue"}>{entry.kind === "NOTE" ? "internal note" : "emailed reply"}</Badge> {entry.author} · {dateTime(entry.created_at)}</p>
            <p className="whitespace-pre-wrap">{entry.body}</p>
          </li>
        ))}
      </ul>
      {canAct ? (
        <div className="mt-4 grid gap-2">
          <Field label="Write a reply or note"><TextArea value={text} maxLength={5000} rows={4} onChange={(event) => setText(event.target.value)} /></Field>
          <div className="flex gap-2">
            <Button tone="green" disabled={!text.trim() || reply.isPending} onClick={() => run(reply.mutateAsync({ kind: "REPLY", body: text.trim() }), "Reply emailed.", () => setText(""))}>Send reply by email</Button>
            <Button disabled={!text.trim() || reply.isPending} onClick={() => run(reply.mutateAsync({ kind: "NOTE", body: text.trim() }), "Note saved.", () => setText(""))}>Add internal note</Button>
          </div>
        </div>
      ) : null}
    </Panel>
    </div>
  )
}
