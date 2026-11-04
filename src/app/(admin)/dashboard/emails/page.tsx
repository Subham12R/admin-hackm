"use client"

import { useEffect, useRef, useState } from "react"
import { Bold, Heading2, Image as ImageIcon, Italic, Link2, List, ListOrdered, Minus, Quote, Table2 } from "lucide-react"

import { Badge, Button, ConfirmButton, Empty, Field, LoadingRows, Notice, PageHeader, Panel, Select, StatusBadge, TextArea, TextInput } from "@/components/admin/kit"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToField, takeHandedTeams, useResolved, type Audience, type ExtraRecipient, type Scope, type Segment } from "@/components/admin/to-field"
import { api, dateTime, errorMessage } from "@/lib/api"
import { notify, toast } from "@/lib/notify"
import { can, keys, useAdminMutation, useAdminQuery, useRoles } from "@/lib/queries"
import { sendToStorage, type SignedUpload } from "@/lib/storage-upload"

type SenderKey = "announcements" | "support" | "noreply"
type Draft = Audience & {
  subject: string
  body_markdown: string
  show_banner: boolean
  banner_url: string
  cta_label: string
  cta_url: string
  sender: SenderKey
}
type Delivery = { PENDING: number; SENT: number; FAILED: number }
type Campaign = Omit<Draft, "audience"> & {
  /** The old fixed audience key when one fits; `segment` is the real value. */
  audience: string
  segment?: string
  delivery?: Delivery | null
  from?: string
  id: string
  status: "DRAFT" | "SENT"
  recipient_count: number
  sent_at: string | null
  sent_by: string | null
  created_at: string
  created_by: string | null
}
type Campaigns = {
  items: Campaign[]
  segments?: Segment[]
  max_recipients?: number
  uploads: boolean
  placeholders: string[]
  senders?: { key: SenderKey; address: string; from: string }[]
}

const AREA = [keys.emailCampaigns]
const EMPTY: Draft = {
  subject: "",
  body_markdown: "Hi {{first_name}},\n\nWrite your update here. **Bold**, *italic*, [links](https://hackmatrix.codes), lists and images all work.\n",
  audience: "PAID",
  audience_scope: "LEADERS",
  segment_stage_id: null,
  team_ids: [],
  extra_recipients: [],
  show_banner: true,
  banner_url: "",
  cta_label: "",
  cta_url: "",
  sender: "announcements",
}
type Tool =
  | { label: string; icon: typeof Bold; wrap: [string, string, string] }
  | { label: string; icon: typeof Bold; prefix: string }
const TOOLS: Tool[] = [
  { label: "Bold", icon: Bold, wrap: ["**", "**", "bold text"] },
  { label: "Italic", icon: Italic, wrap: ["*", "*", "italic text"] },
  { label: "Heading", icon: Heading2, prefix: "## " },
  { label: "Link", icon: Link2, wrap: ["[", "](https://)", "link text"] },
  { label: "Bulleted list", icon: List, prefix: "- " },
  { label: "Numbered list", icon: ListOrdered, prefix: "1. " },
  { label: "Quote", icon: Quote, prefix: "> " },
  { label: "Divider", icon: Minus, wrap: ["\n---\n", "", ""] },
  { label: "Table", icon: Table2, wrap: ["\n| Item | Detail |\n|---|---|\n| Check-in | 9:00 AM |\n", "", ""] },
]
const SENDER_HELP: Record<SenderKey, string> = {
  announcements: "Updates and news (replies go to support)",
  support: "Personal follow-ups (replies come straight back)",
  noreply: "Account and system notices (replies go to support)",
}
const IMAGE_TYPES = ["image/gif", "image/jpeg", "image/png"]
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function draftOf(campaign: Campaign): Draft {
  const { subject, body_markdown, show_banner, banner_url, cta_label, cta_url } = campaign
  return {
    subject, body_markdown, show_banner, banner_url, cta_label, cta_url, sender: campaign.sender ?? "announcements",
    audience: campaign.segment ?? "PAID",
    audience_scope: (campaign.audience_scope ?? "LEADERS") as Scope,
    segment_stage_id: campaign.segment_stage_id ?? null,
    team_ids: campaign.team_ids ?? [],
    extra_recipients: (campaign.extra_recipients ?? []).map((item: ExtraRecipient) => ({ ...item, name: item.name ?? "", team_name: item.team_name ?? "" })),
  }
}

function segmentLabel(campaigns: Campaigns, campaign: Campaign) {
  const segment = campaigns.segments?.find((item) => item.key === campaign.segment)
  const parts = []
  if (segment && segment.key !== "NONE") parts.push(`${segment.label} (${campaign.audience_scope === "MEMBERS" ? "all members" : "leaders"})`)
  if (campaign.team_ids?.length) parts.push(`${campaign.team_ids.length} picked team${campaign.team_ids.length === 1 ? "" : "s"}`)
  if (campaign.extra_recipients?.length) parts.push(`${campaign.extra_recipients.length} added`)
  return parts.join(" + ") || "Nobody yet"
}

/** Upload an email image (GIF/JPEG/PNG) straight to storage and return its public URL. */
async function uploadImage(file: File) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Email images must be GIF, JPEG or PNG.")
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Email images must be at most 10 MB.")
  const signed = await api<SignedUpload & { public_url: string }>("/api/admin/email-campaigns/uploads", { method: "POST", body: { content_type: file.type, size_bytes: file.size } })
  if (!(await sendToStorage(signed, file, () => {}))) throw new Error("The image could not reach storage. Check the bucket's CORS rule.")
  return signed.public_url
}

export default function EmailsPage() {
  const canWrite = can.eventControl(useRoles())
  const campaigns = useAdminQuery<Campaigns>(keys.emailCampaigns, "/api/admin/email-campaigns")
  // `session` keys the composer: saving a new draft assigns an id but must not remount (and reset) the editor.
  const [editing, setEditing] = useState<{ session: number; id: string | null; draft: Draft } | null>(null)
  const open = (id: string | null, draft: Draft) => setEditing({ session: Date.now(), id, draft })
  const remove = useAdminMutation<string>((id) => ({ path: `/api/admin/email-campaigns/${id}`, method: "DELETE" }), AREA)
  const [report, setReport] = useState<string | null>(null)
  const data = campaigns.data

  // "Email selected" on Teams / Registrations lands here with the picked teams in the To field.
  useEffect(() => {
    if (!canWrite || !new URLSearchParams(window.location.search).has("compose")) return
    const handed = takeHandedTeams()
    window.history.replaceState(window.history.state, "", "/dashboard/emails")
    if (!handed?.ids.length) return
    const timer = window.setTimeout(() => setEditing({ session: Date.now(), id: null, draft: { ...EMPTY, subject: "", audience: "NONE", audience_scope: handed.scope, team_ids: handed.ids } }), 0)
    return () => window.clearTimeout(timer)
  }, [canWrite])

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader
        title="Email"
        description="Write a one-off email in Markdown, preview it exactly as teams will see it, test it on yourself, then send. Separate from dashboard announcements."
        actions={canWrite && !editing ? <Button tone="green" onClick={() => open(null, EMPTY)}>New email</Button> : null}
      />
      {campaigns.isError ? <Notice tone="red">{errorMessage(campaigns.error, "Emails could not be loaded.")}</Notice> : null}
      {editing && data ? (
        <Composer key={editing.session} id={editing.id} initial={editing.draft} campaigns={data}
          onSaved={(id) => setEditing((current) => current && { ...current, id })} onClose={() => setEditing(null)} />
      ) : null}

      <Panel title="Sent and drafts" description="Sent emails are kept for the record; duplicate one to send a new version.">
        {!data ? <LoadingRows /> : data.items.length ? (
          <ul className="divide-y divide-border">
            {data.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate">{item.subject}</span>
                    <StatusBadge status={item.status} />
                    <Badge>{segmentLabel(data, item)}</Badge>
                    {item.from ? <Badge>from {item.from}</Badge> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.sent_at
                      ? `Sent ${dateTime(item.sent_at)} to ${item.recipient_count} ${item.recipient_count === 1 ? "person" : "people"}${item.sent_by ? ` by ${item.sent_by}` : ""}`
                      : `Drafted ${dateTime(item.created_at)}${item.created_by ? ` by ${item.created_by}` : ""}`}
                    {item.delivery ? <DeliveryLine delivery={item.delivery} /> : null}
                  </p>
                </div>
                {item.status === "SENT" ? (
                  <Button onClick={() => setReport((current) => current === item.id ? null : item.id)} aria-expanded={report === item.id}>
                    {report === item.id ? "Hide report" : "Report"}
                  </Button>
                ) : null}
                {canWrite ? (
                  <div className="flex flex-wrap gap-1">
                    {item.status === "DRAFT" ? <Button onClick={() => open(item.id, draftOf(item))}>Edit</Button> : null}
                    <Button onClick={() => open(null, { ...draftOf(item), subject: item.status === "SENT" ? item.subject : `${item.subject} (copy)` })}>Duplicate</Button>
                    <ConfirmButton confirmLabel={item.status === "SENT" ? "Delete record" : "Delete draft"} disabled={remove.isPending}
                      onConfirm={() => void notify(remove.mutateAsync(item.id), "Email deleted.", () => { if (editing?.id === item.id) setEditing(null) })}>
                      Delete
                    </ConfirmButton>
                  </div>
                ) : null}
                {report === item.id ? <Report id={item.id} canRetry={canWrite} /> : null}
              </li>
            ))}
          </ul>
        ) : <Empty>No emails yet.</Empty>}
      </Panel>
    </div>
  )
}

function Composer({ id, initial, campaigns, onSaved, onClose }: {
  id: string | null
  initial: Draft
  campaigns: Campaigns
  onSaved: (id: string) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const [savedDraft, setSavedDraft] = useState<Draft | null>(id ? initial : null)
  const [uploading, setUploading] = useState<"banner" | "inline" | null>(null)
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")
  const body = useRef<HTMLTextAreaElement>(null)
  const inlineFile = useRef<HTMLInputElement>(null)
  const bannerFile = useRef<HTMLInputElement>(null)
  const create = useAdminMutation<Draft, Campaign>((payload) => ({ path: "/api/admin/email-campaigns", body: payload }), AREA)
  const update = useAdminMutation<{ id: string; draft: Draft }, Campaign>(({ id, draft }) => ({ path: `/api/admin/email-campaigns/${id}`, method: "PATCH", body: draft }), AREA)
  const test = useAdminMutation<string, { sent_to: string }>((campaignId) => ({ path: `/api/admin/email-campaigns/${campaignId}/test` }), AREA)
  const send = useAdminMutation<string, Campaign>((campaignId) => ({ path: `/api/admin/email-campaigns/${campaignId}/send` }), AREA)
  const preview = usePreview(draft)
  const busy = create.isPending || update.isPending || test.isPending || send.isPending
  const buttonIncomplete = Boolean(draft.cta_label.trim()) !== Boolean(draft.cta_url.trim())
  const ready = draft.subject.trim().length > 0 && !buttonIncomplete
  const resolved = useResolved({
    audience: draft.audience, audience_scope: draft.audience_scope, segment_stage_id: draft.segment_stage_id,
    team_ids: draft.team_ids, extra_recipients: draft.extra_recipients,
  })
  const recipients = resolved.data?.count ?? 0
  const overCap = recipients > (campaigns.max_recipients ?? 2000)
  const bannerMode = !draft.show_banner ? "none" : draft.banner_url ? "custom" : "default"

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  /** Persist the draft (create or update) and return its id; later actions always act on what is saved. */
  async function save(): Promise<string> {
    const clean = { ...draft, subject: draft.subject.trim(), cta_label: draft.cta_label.trim(), cta_url: draft.cta_url.trim(), banner_url: draft.banner_url.trim() }
    if (id && savedDraft && JSON.stringify(savedDraft) === JSON.stringify(clean)) return id
    const saved = id ? await update.mutateAsync({ id, draft: clean }) : await create.mutateAsync(clean)
    setSavedDraft(clean)
    onSaved(saved.id)
    return saved.id
  }

  /** Wrap the selection (or insert at the cursor) in the textarea, keeping focus and selection sensible. */
  function insert(before: string, after = "", placeholder = "") {
    const area = body.current
    if (!area) return
    const { selectionStart: start, selectionEnd: end, value } = area
    const selected = value.slice(start, end) || placeholder
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    set("body_markdown", next)
    requestAnimationFrame(() => {
      area.focus()
      area.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  function linePrefix(prefix: string) {
    const area = body.current
    if (!area) return
    const { selectionStart: start, selectionEnd: end, value } = area
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    const block = value.slice(lineStart, end) || "Item"
    const prefixed = block.split("\n").map((line, index) => (prefix === "1. " ? `${index + 1}. ` : prefix) + line).join("\n")
    set("body_markdown", value.slice(0, lineStart) + prefixed + value.slice(end))
    requestAnimationFrame(() => area.focus())
  }

  async function onImage(file: File | undefined, target: "banner" | "inline") {
    if (!file) return
    setUploading(target)
    try {
      const url = await uploadImage(file)
      if (target === "banner") setDraft((current) => ({ ...current, show_banner: true, banner_url: url }))
      else insert(`![${file.name.replace(/\.[^.]+$/, "")}](${url})\n`)
      toast.success(target === "banner" ? "Banner uploaded." : "Image inserted.")
    } catch (error) {
      toast.error(errorMessage(error, "The image could not be uploaded."))
    } finally {
      setUploading(null)
    }
  }

  function applyTool(tool: Tool) {
    if ("prefix" in tool) linePrefix(tool.prefix)
    else insert(...tool.wrap)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title={id ? "Edit email" : "New email"} description={resolved.data ? `Goes to ${recipients} ${recipients === 1 ? "person" : "people"}.` : "Counting recipients…"}
        actions={<Button onClick={onClose}>Close</Button>}>
        <div className="grid gap-3">
          <Field label="Subject">
            <TextInput value={draft.subject} maxLength={200} onChange={(event) => set("subject", event.target.value)} placeholder="Hack Day: what to bring" />
          </Field>
          <Field label="Send from" hint={SENDER_HELP[draft.sender]}>
            <Select value={draft.sender} onChange={(event) => set("sender", event.target.value as SenderKey)}>
              {(campaigns.senders ?? (Object.keys(SENDER_HELP) as SenderKey[]).map((key) => ({ key, address: `${key}@hackmatrix.codes`, from: key }))).map((sender) => (
                <option key={sender.key} value={sender.key}>{sender.from}</option>
              ))}
            </Select>
          </Field>
          <div className="flex min-w-0 flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
            <span>To</span>
            <ToField
              value={{ audience: draft.audience, audience_scope: draft.audience_scope, segment_stage_id: draft.segment_stage_id, team_ids: draft.team_ids, extra_recipients: draft.extra_recipients }}
              onChange={(next) => setDraft((current) => ({ ...current, ...next }))}
              segments={campaigns.segments ?? []}
              resolved={resolved}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Banner">
              <Select value={bannerMode} onChange={(event) => {
                const mode = event.target.value
                setDraft((current) => ({ ...current, show_banner: mode !== "none", banner_url: mode === "custom" ? current.banner_url || "https://" : "" }))
              }}>
                <option value="default">HackMatrix banner (animated GIF)</option>
                <option value="custom">Custom image or GIF</option>
                <option value="none">No banner</option>
              </Select>
            </Field>
          </div>
          {bannerMode === "custom" ? (
            <Field label="Banner image URL" hint="Upload a GIF, JPEG or PNG (up to 10 MB), or paste a link. 1128 px wide looks sharp.">
              <div className="flex gap-2">
                <TextInput value={draft.banner_url} onChange={(event) => set("banner_url", event.target.value)} className="flex-1" />
                {campaigns.uploads ? (
                  <Button disabled={uploading !== null} onClick={() => bannerFile.current?.click()}>{uploading === "banner" ? "Uploading…" : "Upload"}</Button>
                ) : null}
              </div>
            </Field>
          ) : null}

          {/* Not a <Field>: a <label> around the toolbar would route clicks on its text to the first button. */}
          <div className="flex min-w-0 flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
            <span id="email-body-label" className="leading-4">Message (Markdown)</span>
            <div className="overflow-hidden rounded-md border border-border">
              <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-1" role="toolbar" aria-label="Formatting">
                {TOOLS.map((tool) => (
                  <button key={tool.label} type="button" title={tool.label} aria-label={tool.label} onClick={() => applyTool(tool)}
                    className="flex size-7 items-center justify-center rounded hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-ring">
                    <tool.icon className="size-4" aria-hidden="true" />
                  </button>
                ))}
                {campaigns.uploads ? (
                  <button type="button" title="Insert image or GIF" aria-label="Insert image or GIF" disabled={uploading !== null} onClick={() => inlineFile.current?.click()}
                    className="flex h-7 items-center gap-1 rounded px-1.5 text-xs hover:bg-foreground/10 disabled:opacity-50">
                    <ImageIcon className="size-4" aria-hidden="true" />{uploading === "inline" ? "Uploading…" : "Image"}
                  </button>
                ) : null}
                <Select aria-label="Insert placeholder" value="" className="ml-auto h-7 w-auto text-xs" onChange={(event) => { if (event.target.value) insert(`{{${event.target.value}}}`) }}>
                  <option value="">Insert field…</option>
                  {campaigns.placeholders.map((key) => <option key={key} value={key}>{key.replace("_", " ")}</option>)}
                </Select>
              </div>
              <TextArea ref={body} aria-labelledby="email-body-label" value={draft.body_markdown} onChange={(event) => set("body_markdown", event.target.value)} rows={16}
                className="block min-h-80 w-full resize-y rounded-none border-0 font-mono text-sm focus-visible:ring-0" />
            </div>
            <span className="text-[11px]">Personalise with {campaigns.placeholders.map((key) => `{{${key}}}`).join(", ")}. Raw HTML is shown as text.</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <Field label="Button label (optional)">
              <TextInput value={draft.cta_label} maxLength={80} onChange={(event) => set("cta_label", event.target.value)} placeholder="Open dashboard" />
            </Field>
            <Field label="Button link" error={buttonIncomplete ? "Fill in both the label and the link, or neither." : undefined}>
              <TextInput value={draft.cta_url} onChange={(event) => set("cta_url", event.target.value)} placeholder="https://hackmatrix.codes/dashboard" />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={!ready || busy} onClick={() => void notify(save(), "Draft saved.")}>Save draft</Button>
            <Button disabled={!ready || busy} onClick={() => void notify(save().then((campaignId) => test.mutateAsync(campaignId)).then((result) => { toast.success(`Test sent to ${result.sent_to}.`) }), "Draft saved.")}>
              {test.isPending ? "Sending test…" : "Send test to me"}
            </Button>
            <ConfirmButton tone="green" confirmLabel={`Send to ${recipients} ${recipients === 1 ? "person" : "people"} now`} disabled={!ready || busy || recipients === 0 || overCap || !resolved.data}
              onConfirm={() => void notify(save().then((campaignId) => send.mutateAsync(campaignId)), `Email queued for ${recipients} ${recipients === 1 ? "person" : "people"}.`, onClose)}>
              Send…
            </ConfirmButton>
          </div>
          <input ref={inlineFile} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={(event) => { void onImage(event.target.files?.[0], "inline"); event.target.value = "" }} />
          <input ref={bannerFile} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={(event) => { void onImage(event.target.files?.[0], "banner"); event.target.value = "" }} />
        </div>
      </Panel>

      <Panel title="Preview" description="Rendered by the same code that sends it, with sample values (Alex Sharma, Team Matrix)."
        actions={
          <span className="flex gap-1">
            {(["desktop", "mobile"] as const).map((mode) => (
              <Button key={mode} tone={device === mode ? "amber" : "zinc"} aria-pressed={device === mode} onClick={() => setDevice(mode)}>{mode === "desktop" ? "Desktop" : "Mobile"}</Button>
            ))}
          </span>
        }>
        {preview.error ? <Notice tone="amber">{preview.error}</Notice> : null}
        <div className="flex justify-center rounded-xl bg-muted/40 p-2">
          {preview.html ? (
            <iframe title="Email preview" srcDoc={preview.html} sandbox="allow-popups allow-popups-to-escape-sandbox"
              className={`h-[78vh] rounded-lg border-0 bg-white transition-[width] duration-300 ${device === "mobile" ? "w-[375px]" : "w-full"}`} />
          ) : <div className="h-[78vh] w-full"><LoadingRows rows={8} /></div>}
        </div>
      </Panel>
    </div>
  )
}

/** Server-rendered preview, refreshed 400 ms after typing stops; keeps the last good render on errors. */
function usePreview(draft: Draft) {
  const [state, setState] = useState<{ html: string; error: string }>({ html: "", error: "" })
  const subject = draft.subject.trim() || "Untitled email"
  const payload = JSON.stringify({ ...draft, subject, cta_label: draft.cta_label.trim(), cta_url: draft.cta_url.trim(), banner_url: draft.banner_url.trim() })

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      api<{ html: string }>("/api/admin/email-campaigns/preview", { method: "POST", body: JSON.parse(payload), signal: controller.signal })
        // Links in the preview open in a new tab instead of navigating the frame.
        .then((result) => setState({ html: result.html.replace("<head>", '<head><base target="_blank">'), error: "" }))
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setState((current) => ({ ...current, error: errorMessage(error, "Preview could not be rendered.") }))
        })
    }, 400)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [payload])

  return state
}

function DeliveryLine({ delivery }: { delivery: Delivery }) {
  return (
    <span className="ml-1">
      · {delivery.SENT} delivered{delivery.PENDING ? `, ${delivery.PENDING} sending` : ""}
      {delivery.FAILED ? <span className="text-red-600">, {delivery.FAILED} failed</span> : null}
    </span>
  )
}

type ReportData = {
  counts: Delivery
  recipients: { email: string; name: string; team_name: string; source: string; status: string; error: string | null; attempts: number; sent_at: string | null }[]
}

/** Who a sent email went to and how each delivery went; failed ones can be sent again. */
function Report({ id, canRetry }: { id: string; canRetry: boolean }) {
  const report = useAdminQuery<ReportData>(["email-report", id], `/api/admin/email-campaigns/${id}/report`, { refetchInterval: 10_000 })
  const retry = useAdminMutation<void, { retried: number }>(() => ({ path: `/api/admin/email-campaigns/${id}/retry-failed` }), [AREA[0], ["email-report", id]])
  const [only, setOnly] = useState<"all" | "FAILED" | "PENDING">("all")
  const data = report.data
  const rows = (data?.recipients ?? []).filter((row) => only === "all" || row.status === only)

  return (
    <div className="mt-2 w-full rounded-lg bg-muted/40 p-3">
      {report.isError ? <Notice tone="red">{errorMessage(report.error, "The report could not be loaded.")}</Notice> : null}
      {!data ? <LoadingRows rows={3} /> : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="green">{data.counts.SENT} delivered</Badge>
            {data.counts.PENDING ? <Badge tone="amber">{data.counts.PENDING} sending</Badge> : null}
            {data.counts.FAILED ? <Badge tone="red">{data.counts.FAILED} failed</Badge> : null}
            <Select aria-label="Show" value={only} onChange={(event) => setOnly(event.target.value as typeof only)} className="ml-auto h-7 w-auto text-xs">
              <option value="all">Everyone</option>
              <option value="FAILED">Failed</option>
              <option value="PENDING">Still sending</option>
            </Select>
            {canRetry && data.counts.FAILED ? (
              <Button tone="amber" disabled={retry.isPending}
                onClick={() => void notify(retry.mutateAsync().then((result) => { toast.success(`Sending ${result.retried} again.`) }), "Retry queued.")}>
                Retry {data.counts.FAILED} failed
              </Button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Person", "Team", "Added as", "Status", "Detail"].map((label) => <TableHead key={label} className="h-8 normal-case tracking-tighter">{label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.email}>
                    <TableCell className="text-xs">{row.name}<p className="text-muted-foreground">{row.email}</p></TableCell>
                    <TableCell className="text-xs">{row.team_name || "—"}</TableCell>
                    <TableCell className="text-xs">{row.source === "SEGMENT" ? "Segment" : row.source === "TEAM" ? "Picked team" : "Added"}</TableCell>
                    <TableCell><StatusBadge status={row.status} label={row.status === "SENT" ? "Delivered" : row.status === "PENDING" ? "Sending" : "Failed"} /></TableCell>
                    <TableCell className="max-w-64 truncate text-xs text-muted-foreground" title={row.error ?? undefined}>
                      {row.error ?? (row.sent_at ? dateTime(row.sent_at) : "")}{row.attempts > 1 ? ` · ${row.attempts} tries` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
