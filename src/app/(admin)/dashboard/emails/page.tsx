"use client"

import { useEffect, useRef, useState } from "react"
import { Bold, Heading2, Image as ImageIcon, Italic, Link2, List, ListOrdered, Minus, Quote, Table2 } from "lucide-react"

import { Badge, Button, ConfirmButton, Empty, Field, LoadingRows, Notice, PageHeader, Panel, Select, StatusBadge, TextArea, TextInput } from "@/components/admin/kit"
import { api, dateTime, errorMessage } from "@/lib/api"
import { notify, toast } from "@/lib/notify"
import { can, keys, useAdminMutation, useAdminQuery, useMe } from "@/lib/queries"
import { sendToStorage, type SignedUpload } from "@/lib/storage-upload"

type Audience = "LEADERS" | "MEMBERS" | "FINALIST_LEADERS" | "FINALIST_MEMBERS"
type Draft = {
  subject: string
  body_markdown: string
  audience: Audience
  show_banner: boolean
  banner_url: string
  cta_label: string
  cta_url: string
}
type Campaign = Draft & {
  id: string
  status: "DRAFT" | "SENT"
  recipient_count: number
  sent_at: string | null
  sent_by: string | null
  created_at: string
  created_by: string | null
}
type Campaigns = { items: Campaign[]; audiences: Record<Audience, number>; uploads: boolean; placeholders: string[] }

const AREA = [keys.emailCampaigns]
const AUDIENCES: Record<Audience, string> = {
  LEADERS: "Team leaders",
  MEMBERS: "Every team member",
  FINALIST_LEADERS: "Finalist team leaders",
  FINALIST_MEMBERS: "Every finalist member",
}
const EMPTY: Draft = {
  subject: "",
  body_markdown: "Hi {{first_name}},\n\nWrite your update here. **Bold**, *italic*, [links](https://hackmatrix.codes), lists and images all work.\n",
  audience: "LEADERS",
  show_banner: true,
  banner_url: "",
  cta_label: "",
  cta_url: "",
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
const IMAGE_TYPES = ["image/gif", "image/jpeg", "image/png"]
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function draftOf(campaign: Campaign): Draft {
  const { subject, body_markdown, audience, show_banner, banner_url, cta_label, cta_url } = campaign
  return { subject, body_markdown, audience, show_banner, banner_url, cta_label, cta_url }
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
  const me = useMe()
  const canWrite = can.eventControl(me.data?.user.roles ?? [])
  const campaigns = useAdminQuery<Campaigns>(keys.emailCampaigns, "/api/admin/email-campaigns")
  // `session` keys the composer: saving a new draft assigns an id but must not remount (and reset) the editor.
  const [editing, setEditing] = useState<{ session: number; id: string | null; draft: Draft } | null>(null)
  const open = (id: string | null, draft: Draft) => setEditing({ session: Date.now(), id, draft })
  const remove = useAdminMutation<string>((id) => ({ path: `/api/admin/email-campaigns/${id}`, method: "DELETE" }), AREA)
  const data = campaigns.data

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
                    <Badge>{AUDIENCES[item.audience]}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.sent_at
                      ? `Sent ${dateTime(item.sent_at)} to ${item.recipient_count} ${item.recipient_count === 1 ? "person" : "people"}${item.sent_by ? ` by ${item.sent_by}` : ""}`
                      : `Drafted ${dateTime(item.created_at)}${item.created_by ? ` by ${item.created_by}` : ""}`}
                  </p>
                </div>
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
  const recipients = campaigns.audiences[draft.audience] ?? 0
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
      <Panel title={id ? "Edit email" : "New email"} description={`Goes to ${recipients} ${recipients === 1 ? "person" : "people"} (${AUDIENCES[draft.audience].toLowerCase()} of paid teams).`}
        actions={<Button onClick={onClose}>Close</Button>}>
        <div className="grid gap-3">
          <Field label="Subject">
            <TextInput value={draft.subject} maxLength={200} onChange={(event) => set("subject", event.target.value)} placeholder="Hack Day: what to bring" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Send to">
              <Select value={draft.audience} onChange={(event) => set("audience", event.target.value as Audience)}>
                {(Object.keys(AUDIENCES) as Audience[]).map((key) => <option key={key} value={key}>{AUDIENCES[key]} ({campaigns.audiences[key] ?? 0})</option>)}
              </Select>
            </Field>
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
            <ConfirmButton tone="green" confirmLabel={`Send to ${recipients} now`} disabled={!ready || busy || recipients === 0}
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
