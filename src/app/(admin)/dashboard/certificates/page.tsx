"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useRef, useState } from "react"

import { useQuery } from "@tanstack/react-query"

import { CertificateEditor } from "@/components/admin/certificate-editor"
import { Badge, Button, ConfirmButton, Empty, Field, FieldAction, LoadingRows, Notice, PageHeader, Panel, Select, StatusBadge, TextArea, TextInput } from "@/components/admin/kit"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, dateTime, errorMessage } from "@/lib/api"
import {
  CATEGORY_LABELS,
  defaultLayout,
  IMAGE_TYPES,
  uploadCredentialImage,
  type BadgeDefinition,
  type Candidate,
  type CertificateType,
  type CertificateTypes,
  type IssuedCredential,
  type LayoutField,
} from "@/lib/credentials"
import { notify, toast } from "@/lib/notify"
import { can, keys, useAdminMutation, useAdminQuery, useMe } from "@/lib/queries"
import { useStages, type Stage } from "@/lib/stages"
import { cn } from "@/lib/utils"

const TABS = [
  ["templates", "Certificate templates"],
  ["badges", "Badges"],
  ["issue", "Issue"],
  ["issued", "Issued"],
] as const
type Tab = (typeof TABS)[number][0]

const AREAS = [["certificate-types"], ["badges"], ["credentials"], ["candidates"], ["stages"]]

export default function CertificatesPage() {
  return (
    <Suspense fallback={<LoadingRows />}>
      <Certificates />
    </Suspense>
  )
}

function Certificates() {
  const me = useMe()
  const editable = can.eventControl(me.data?.user.roles ?? [])
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const stages = useStages()
  // The event and tab live in the URL so a reload or a shared link keeps the same view.
  const stageId = params?.get("event") || stages.data?.items[0]?.id || ""
  const tab = (TABS.find(([value]) => value === params?.get("tab"))?.[0] ?? "templates") as Tab
  const stage = stages.data?.items.find((item) => item.id === stageId)
  const types = useAdminQuery<CertificateTypes>(keys.certificateTypes(stageId), stageId ? `/api/admin/certificate-types?stage_id=${stageId}` : null)
  const badges = useAdminQuery<{ configured: boolean; items: BadgeDefinition[] }>(keys.badges, "/api/admin/badges")
  const stageBadges = (badges.data?.items ?? []).filter((badge) => badge.stage_id === stageId || badge.stage_id === null)

  function select(next: { event?: string; tab?: string }) {
    const search = new URLSearchParams(params?.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value) search.set(key, value)
      else search.delete(key)
    }
    router.replace(`${pathname}?${search.toString()}`, { scroll: false })
  }

  if (stages.isError) return <Notice tone="red">{errorMessage(stages.error, "Events could not be loaded.")}</Notice>

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader
        title="Certificates & badges"
        description="Design certificates, define badges, issue them in bulk as drafts, then publish. Teams only see published credentials; certificates publish once the event is marked completed."
        actions={stages.data ? (
          <Select aria-label="Event" value={stageId} onChange={(event) => select({ event: event.target.value })}>
            {stages.data.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        ) : null}
      />

      {types.data && !types.data.configured ? (
        <Notice tone="amber">File storage is not configured on the server, so artwork and badge images cannot be uploaded and certificates cannot be drawn. Set the R2_* variables in the backend environment.</Notice>
      ) : null}

      {stage ? <Completion stage={stage} editable={editable} /> : stages.isLoading ? <LoadingRows /> : <Empty>Create an event first on the Events page.</Empty>}

      {stage ? (
        <>
          <div role="tablist" className="flex flex-wrap gap-1">
            {TABS.map(([value, label]) => (
              <Button key={value} role="tab" aria-selected={tab === value} tone={tab === value ? "amber" : "zinc"} onClick={() => select({ tab: value })}>
                {label}
              </Button>
            ))}
          </div>
          {tab === "templates" ? <TemplatesTab stage={stage} data={types.data} editable={editable} /> : null}
          {tab === "badges" ? <BadgesTab stage={stage} stages={stages.data?.items ?? []} badges={stageBadges} loading={badges.isLoading} editable={editable} /> : null}
          {tab === "issue" && !(types.data && badges.data) ? <LoadingRows /> : null}
          {tab === "issue" && types.data && badges.data ? <IssueTab key={stage.id} stage={stage} types={types.data?.items ?? []} badges={stageBadges} editable={editable} onIssued={() => select({ tab: "issued" })} /> : null}
          {tab === "issued" ? <IssuedTab key={stage.id} stage={stage} types={types.data?.items ?? []} badges={stageBadges} editable={editable} /> : null}
        </>
      ) : null}
    </div>
  )
}

function Completion({ stage, editable }: { stage: Stage; editable: boolean }) {
  const complete = useAdminMutation<boolean>((done) => ({ path: `/api/admin/stages/${stage.id}/complete`, method: done ? "POST" : "DELETE" }), AREAS)
  return (
    <Panel
      title={stage.completed_at ? "Event completed" : "Event in progress"}
      description={stage.completed_at
        ? `Marked completed ${dateTime(stage.completed_at)}. Its certificates can be published.`
        : "Certificates for this event stay drafts until you mark it completed. Badges can be published at any time."}
      actions={
        <span className="flex items-center gap-2">
          <Badge tone={stage.completed_at ? "green" : "amber"}>{stage.completed_at ? "completed" : "not completed"}</Badge>
          {editable ? (
            stage.completed_at ? (
              <ConfirmButton confirmLabel="Reopen event" disabled={complete.isPending}
                onConfirm={() => void notify(complete.mutateAsync(false), "Event reopened. Published certificates stay published.")}>Reopen</ConfirmButton>
            ) : (
              <ConfirmButton tone="green" confirmLabel="Yes, mark completed" disabled={complete.isPending}
                onConfirm={() => void notify(complete.mutateAsync(true), "Event marked completed. Its certificates can now be published.")}>Mark event completed</ConfirmButton>
            )
          ) : null}
        </span>
      }
    >
      {null}
    </Panel>
  )
}

// ---- templates ----

function TemplatesTab({ stage, data, editable }: { stage: Stage; data: CertificateTypes | undefined; editable: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const items = data?.items ?? []
  const open = items.find((item) => item.id === openId) ?? null
  return (
    <div className="flex flex-col gap-4">
      {editable && data?.configured ? <NewTemplate stage={stage} onCreated={setOpenId} /> : null}
      <Panel title="Certificate types" description={`Each type has its own artwork. Members can hold one certificate of each type for ${stage.name}.`}>
        {!data ? <LoadingRows /> : items.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => setOpenId(item.id === openId ? null : item.id)}
                  className={cn("flex w-full flex-col overflow-hidden rounded-xl border text-left", item.id === openId ? "border-sky-500" : "border-border")}>
                  <div className="relative w-full bg-muted" style={{ aspectRatio: `${item.width} / ${item.height}` }}>
                    {item.background_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- bucket URL thumbnail
                      <img src={item.background_url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
                    ) : null}
                  </div>
                  <span className="flex flex-col gap-1 p-2">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="flex flex-wrap gap-1">
                      <Badge>{CATEGORY_LABELS[item.category]}</Badge>
                      <Badge tone="amber">{item.counts.DRAFT} drafts</Badge>
                      <Badge tone="green">{item.counts.PUBLISHED} published</Badge>
                      {item.counts.REVOKED ? <Badge tone="red">{item.counts.REVOKED} revoked</Badge> : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : <Empty>No certificate types for this event yet.{editable ? " Upload artwork above to create one." : ""}</Empty>}
      </Panel>
      {open && data ? <TemplateDetail key={open.id} item={open} fonts={data.fonts} editable={editable} onClosed={() => setOpenId(null)} /> : null}
    </div>
  )
}

function NewTemplate({ stage, onCreated }: { stage: Stage; onCreated: (id: string) => void }) {
  const [name, setName] = useState("Certificate of Participation")
  const [category, setCategory] = useState<CertificateType["category"]>("PARTICIPATION")
  const [issueDate, setIssueDate] = useState("")
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const create = useAdminMutation<Record<string, unknown>, CertificateType>((body) => ({ path: "/api/admin/certificate-types", body }), AREAS)

  async function upload(file: File | undefined) {
    if (!file || !name.trim()) return
    setBusy(true)
    try {
      const image = await uploadCredentialImage("TEMPLATE", file, setProgress)
      const created = await create.mutateAsync({
        stage_id: stage.id, name: name.trim(), category, background_key: image.key, width: image.width, height: image.height,
        layout: defaultLayout(category), issue_date: issueDate || null,
      })
      toast.success("Certificate type created. Drag the fields into place, preview, then save.")
      onCreated(created.id)
    } catch (error) {
      toast.error(error instanceof Error && !("status" in error) ? error.message : errorMessage(error, "The certificate type could not be created."))
    } finally {
      setBusy(false)
      setProgress(0)
      if (input.current) input.current.value = ""
    }
  }

  return (
    <Panel title="New certificate type" description="Upload blank artwork (PNG, JPEG or WebP, ideally A4 landscape at 300 dpi: 3508×2480). Names, team, QR code and the rest are placed on top.">
      <div className="grid items-start gap-3 md:grid-cols-4">
        <Field label="Name (printed as the title on the verify page)">
          <TextInput value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Kind" hint={category === "WINNER" ? "Placement and track are filled from the event's awards." : undefined}>
          <Select value={category} onChange={(event) => setCategory(event.target.value as CertificateType["category"])}>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Date printed (optional)" hint="Empty prints the day each certificate is drawn.">
          <TextInput type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
        </Field>
        <Field label="Artwork">
          <input ref={input} type="file" accept={IMAGE_TYPES.join(",")} className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
          <Button tone="green" disabled={busy || !name.trim()} onClick={() => input.current?.click()}>
            {busy ? (progress ? `Uploading ${Math.round(progress * 100)}%` : "Creating…") : "Upload artwork"}
          </Button>
        </Field>
      </div>
    </Panel>
  )
}

function TemplateDetail({ item, fonts, editable, onClosed }: { item: CertificateType; fonts: string[]; editable: boolean; onClosed: () => void }) {
  const [form, setForm] = useState({ name: item.name, category: item.category, issue_date: item.issue_date ?? "" })
  const [replacing, setReplacing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const save = useAdminMutation<Record<string, unknown>>((body) => ({ path: `/api/admin/certificate-types/${item.id}`, method: "PATCH", body }), AREAS)
  const remove = useAdminMutation<void>(() => ({ path: `/api/admin/certificate-types/${item.id}`, method: "DELETE" }), AREAS)
  const redraw = useAdminMutation<void, { queued: number }>(() => ({ path: `/api/admin/certificate-types/${item.id}/rerender` }), AREAS)
  const issued = item.counts.DRAFT + item.counts.PUBLISHED + item.counts.REVOKED
  const dirty = form.name !== item.name || form.category !== item.category || form.issue_date !== (item.issue_date ?? "")

  async function replace(file: File | undefined) {
    if (!file) return
    setReplacing(true)
    try {
      const image = await uploadCredentialImage("TEMPLATE", file)
      await save.mutateAsync({ background_key: image.key, width: image.width, height: image.height })
      toast.success("Artwork replaced. Check the layout, then redraw issued certificates to apply it.")
    } catch (error) {
      toast.error(error instanceof Error && !("status" in error) ? error.message : errorMessage(error, "The artwork could not be replaced."))
    } finally {
      setReplacing(false)
      if (input.current) input.current.value = ""
    }
  }

  return (
    <Panel
      title={item.name}
      description={`${item.width}×${item.height}px · ${issued} issued`}
      actions={editable ? (
        <span className="flex flex-wrap items-center gap-2">
          <input ref={input} type="file" accept={IMAGE_TYPES.join(",")} className="hidden" onChange={(event) => void replace(event.target.files?.[0])} />
          <Button disabled={replacing} onClick={() => input.current?.click()}>{replacing ? "Uploading…" : "Replace artwork"}</Button>
          {issued ? (
            <ConfirmButton tone="amber" confirmLabel="Redraw all (same IDs)" disabled={redraw.isPending}
              onConfirm={() => void redraw.mutateAsync().then((result) => toast.success(`${result.queued} certificates are being redrawn.`)).catch((error) => toast.error(errorMessage(error)))}>
              Redraw issued certificates
            </ConfirmButton>
          ) : (
            <ConfirmButton confirmLabel="Delete type" disabled={remove.isPending}
              onConfirm={() => void notify(remove.mutateAsync(), "Certificate type deleted.", onClosed)}>Delete</ConfirmButton>
          )}
        </span>
      ) : null}
    >
      <div className="flex flex-col gap-4">
        <form className="grid items-start gap-3 md:grid-cols-4" onSubmit={(event) => {
          event.preventDefault()
          void notify(save.mutateAsync({ name: form.name.trim(), category: form.category, issue_date: form.issue_date || null }), "Certificate type saved.")
        }}>
          <Field label="Name">
            <TextInput value={form.name} maxLength={120} disabled={!editable} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Kind">
            <Select value={form.category} disabled={!editable} onChange={(event) => setForm({ ...form, category: event.target.value as CertificateType["category"] })}>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Date printed" hint="Empty prints the day each certificate is drawn.">
            <TextInput type="date" value={form.issue_date} disabled={!editable} onChange={(event) => setForm({ ...form, issue_date: event.target.value })} />
          </Field>
          {editable ? (
            <FieldAction>
              <Button tone="green" type="submit" disabled={!dirty || !form.name.trim() || save.isPending}>Save details</Button>
            </FieldAction>
          ) : null}
        </form>
        <CertificateEditor item={item} fonts={fonts} editable={editable} onSaved={(layout: LayoutField[]) => save.mutateAsync({ layout })} />
      </div>
    </Panel>
  )
}

// ---- badges ----

function BadgesTab({ stage, stages, badges, loading, editable }: { stage: Stage; stages: Stage[]; badges: BadgeDefinition[]; loading: boolean; editable: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {editable ? <NewBadge stage={stage} /> : null}
      <Panel title="Badges" description={`Badges for ${stage.name} and hackathon-wide ones. Each award gets its own credential ID and public page.`}>
        {loading ? <LoadingRows /> : badges.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {badges.map((badge) => <BadgeCard key={badge.id} badge={badge} stages={stages} editable={editable} />)}
          </ul>
        ) : <Empty>No badges yet.</Empty>}
      </Panel>
    </div>
  )
}

function NewBadge({ stage }: { stage: Stage }) {
  const [form, setForm] = useState({ name: "", description: "", criteria: "", scope: "stage" as "stage" | "hackathon" })
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const create = useAdminMutation<Record<string, unknown>>((body) => ({ path: "/api/admin/badges", body }), AREAS)

  async function upload(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const image = await uploadCredentialImage("BADGE", file)
      await create.mutateAsync({ name: form.name.trim(), description: form.description, criteria: form.criteria,
                                 stage_id: form.scope === "stage" ? stage.id : null, image_key: image.key })
      toast.success("Badge created. Award it from the Issue tab.")
      setForm({ name: "", description: "", criteria: "", scope: form.scope })
    } catch (error) {
      toast.error(error instanceof Error && !("status" in error) ? error.message : errorMessage(error, "The badge could not be created."))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ""
    }
  }

  return (
    <Panel title="New badge" description="A square PNG or WebP with a transparent background works best (at least 600×600).">
      <div className="grid items-start gap-3 md:grid-cols-2">
        <Field label="Name">
          <TextInput value={form.name} maxLength={120} placeholder="Hack Day Finalist" onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>
        <Field label="Belongs to">
          <Select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value as "stage" | "hackathon" })}>
            <option value="stage">{stage.name}</option>
            <option value="hackathon">The whole hackathon</option>
          </Select>
        </Field>
        <Field label="Description (shown on the public page)">
          <TextArea value={form.description} maxLength={1000} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
        <Field label="Criteria (how it was earned)">
          <TextArea value={form.criteria} maxLength={1000} onChange={(event) => setForm({ ...form, criteria: event.target.value })} />
        </Field>
      </div>
      <div className="mt-3">
        <input ref={input} type="file" accept={IMAGE_TYPES.join(",")} className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
        <Button tone="green" disabled={busy || !form.name.trim()} onClick={() => input.current?.click()}>{busy ? "Creating…" : "Upload image and create"}</Button>
      </div>
    </Panel>
  )
}

function BadgeCard({ badge, stages, editable }: { badge: BadgeDefinition; stages: Stage[]; editable: boolean }) {
  const [form, setForm] = useState({ name: badge.name, description: badge.description, criteria: badge.criteria })
  const save = useAdminMutation<Record<string, unknown>>((body) => ({ path: `/api/admin/badges/${badge.id}`, method: "PATCH", body }), AREAS)
  const remove = useAdminMutation<void>(() => ({ path: `/api/admin/badges/${badge.id}`, method: "DELETE" }), AREAS)
  const input = useRef<HTMLInputElement>(null)
  const awarded = badge.counts.DRAFT + badge.counts.PUBLISHED + badge.counts.REVOKED
  const dirty = form.name !== badge.name || form.description !== badge.description || form.criteria !== badge.criteria

  async function replace(file: File | undefined) {
    if (!file) return
    try {
      const image = await uploadCredentialImage("BADGE", file)
      await save.mutateAsync({ image_key: image.key })
      toast.success("Badge image replaced; awards without their own image show it now.")
    } catch (error) {
      toast.error(error instanceof Error && !("status" in error) ? error.message : errorMessage(error, "The image could not be replaced."))
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border p-3">
      <div className="flex items-start gap-3">
        {badge.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- bucket URL
          <img src={badge.image_url} alt="" className="size-20 shrink-0 rounded-lg bg-muted object-contain" />
        ) : <div className="size-20 shrink-0 rounded-lg bg-muted" />}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium">{badge.name}</span>
          <span className="text-xs text-muted-foreground">{badge.stage_id ? stages.find((stage) => stage.id === badge.stage_id)?.name : "Whole hackathon"}</span>
          <span className="flex flex-wrap gap-1">
            <Badge tone="amber">{badge.counts.DRAFT} drafts</Badge>
            <Badge tone="green">{badge.counts.PUBLISHED} published</Badge>
          </span>
        </div>
      </div>
      {editable ? (
        <>
          <TextInput value={form.name} maxLength={120} aria-label="Name" onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <TextArea value={form.description} maxLength={1000} aria-label="Description" placeholder="Description" className="min-h-16"
            onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <TextArea value={form.criteria} maxLength={1000} aria-label="Criteria" placeholder="Criteria" className="min-h-16"
            onChange={(event) => setForm({ ...form, criteria: event.target.value })} />
          <div className="flex flex-wrap gap-1">
            <Button tone="green" disabled={!dirty || !form.name.trim() || save.isPending}
              onClick={() => void notify(save.mutateAsync({ name: form.name.trim(), description: form.description, criteria: form.criteria }), "Badge saved.")}>Save</Button>
            <input ref={input} type="file" accept={IMAGE_TYPES.join(",")} className="hidden" onChange={(event) => void replace(event.target.files?.[0])} />
            <Button onClick={() => input.current?.click()}>Replace image</Button>
            {!awarded ? (
              <ConfirmButton confirmLabel="Delete badge" disabled={remove.isPending} onConfirm={() => void notify(remove.mutateAsync(), "Badge deleted.")}>Delete</ConfirmButton>
            ) : null}
          </div>
        </>
      ) : <p className="text-xs text-muted-foreground">{badge.description}</p>}
    </li>
  )
}

// ---- issuing ----

type TargetValue = `cert:${string}` | `badge:${string}` | ""
type Filters = { submitted: boolean; finalists: boolean; checked_in: boolean; awarded: boolean; q: string; emails: string }

function defaultsFor(stage: Stage, type: CertificateType | undefined): Filters {
  const base = { submitted: false, finalists: false, checked_in: false, awarded: false, q: "", emails: "" }
  if (type?.category === "WINNER") return { ...base, awarded: true }
  // The online round rewards submitting; a finalists-only event rewards turning up.
  if (type) return stage.eligibility === "FINALISTS" ? { ...base, checked_in: true } : { ...base, submitted: true }
  return base
}

function IssueTab({ stage, types, badges, editable, onIssued }: {
  stage: Stage
  types: CertificateType[]
  badges: BadgeDefinition[]
  editable: boolean
  onIssued: () => void
}) {
  const [target, setTarget] = useState<TargetValue>(types[0] ? `cert:${types[0].id}` : badges[0] ? `badge:${badges[0].id}` : "")
  const type = target.startsWith("cert:") ? types.find((item) => item.id === target.slice(5)) : undefined
  const badge = target.startsWith("badge:") ? badges.find((item) => item.id === target.slice(6)) : undefined
  const [filters, setFilters] = useState<Filters>(() => defaultsFor(stage, type))
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [placements, setPlacements] = useState<Record<string, string>>({})
  const [images, setImages] = useState<Record<string, { key: string; url: string }>>({})
  const [issuing, setIssuing] = useState(false)

  const body = useMemo(() => ({
    stage_id: stage.id,
    certificate_type_id: type?.id ?? null,
    badge_definition_id: badge?.id ?? null,
    submitted: filters.submitted, finalists: filters.finalists, checked_in: filters.checked_in, awarded: filters.awarded, q: filters.q,
    emails: filters.emails.split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean),
  }), [stage.id, type?.id, badge?.id, filters])
  const candidates = useQuery({
    queryKey: keys.candidates(JSON.stringify(body)),
    queryFn: ({ signal }) => api<{ count: number; items: Candidate[] }>("/api/admin/credentials/candidates", { method: "POST", body, signal }),
    enabled: Boolean(type || badge),
  })
  const rows = candidates.data?.items ?? []
  const open = rows.filter((row) => !row.issued)
  const selected = open.filter((row) => picked.has(row.member_id))
  const showPlacement = type?.category === "WINNER" || Boolean(badge)

  function chooseTarget(value: TargetValue) {
    setTarget(value)
    setPicked(new Set())
    setPlacements({})
    setImages({})
    setFilters(defaultsFor(stage, value.startsWith("cert:") ? types.find((item) => item.id === value.slice(5)) : undefined))
  }

  async function ownImage(memberId: string, file: File | undefined) {
    if (!file) return
    try {
      const image = await uploadCredentialImage("BADGE", file)
      setImages((current) => ({ ...current, [memberId]: { key: image.key, url: image.url } }))
    } catch (error) {
      toast.error(error instanceof Error && !("status" in error) ? error.message : errorMessage(error, "The image could not be uploaded."))
    }
  }

  async function issue() {
    setIssuing(true)
    try {
      const recipients = selected.map((row) => ({
        member_id: row.member_id,
        ...(showPlacement && placements[row.member_id] !== undefined ? { placement: placements[row.member_id] } : {}),
        ...(images[row.member_id] ? { image_key: images[row.member_id].key } : {}),
      }))
      const result = await api<{ issued: number; skipped: number }>("/api/admin/credentials/issue", {
        method: "POST", body: { certificate_type_id: type?.id ?? null, badge_definition_id: badge?.id ?? null, recipients },
      })
      toast.success(`${result.issued} draft${result.issued === 1 ? "" : "s"} issued${result.skipped ? `, ${result.skipped} skipped (already issued)` : ""}. Review and publish them in the Issued tab.`)
      setPicked(new Set())
      await candidates.refetch()
      onIssued()
    } catch (error) {
      toast.error(errorMessage(error, "Issuing failed."))
    } finally {
      setIssuing(false)
    }
  }

  if (!types.length && !badges.length) return <Empty>Create a certificate type or a badge first.</Empty>

  return (
    <Panel
      title="Issue in bulk"
      description="Pick what to issue, narrow down who gets it, tick people, then issue drafts. Nothing is visible to teams until you publish."
      actions={editable ? (
        <Button tone="green" disabled={!selected.length || issuing} onClick={() => void issue()}>
          {issuing ? "Issuing…" : `Issue ${selected.length} draft${selected.length === 1 ? "" : "s"}`}
        </Button>
      ) : null}
    >
      <div className="flex flex-col gap-4">
        <div className="grid items-start gap-3 md:grid-cols-3">
          <Field label="What to issue">
            <Select value={target} onChange={(event) => chooseTarget(event.target.value as TargetValue)}>
              {types.length ? (
                <optgroup label="Certificates">
                  {types.map((item) => <option key={item.id} value={`cert:${item.id}`}>{item.name}</option>)}
                </optgroup>
              ) : null}
              {badges.length ? (
                <optgroup label="Badges">
                  {badges.map((item) => <option key={item.id} value={`badge:${item.id}`}>{item.name}</option>)}
                </optgroup>
              ) : null}
            </Select>
          </Field>
          <Field label="Search name, email, team or team ID">
            <TextInput value={filters.q} maxLength={200} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
          </Field>
          <Field label="Only these emails (optional)" hint="Paste emails separated by commas, spaces or new lines.">
            <TextArea value={filters.emails} className="min-h-8" onChange={(event) => setFilters({ ...filters, emails: event.target.value })} />
          </Field>
        </div>
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="mb-1 text-xs text-muted-foreground">Everyone ticked here must match</legend>
          {([
            ["submitted", `Team submitted in ${stage.name}`],
            ["finalists", "Team accepted for the finals"],
            ["checked_in", "Member checked in at the venue"],
            ["awarded", "Team holds an award in this event"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.checked })} />
              {label}
            </label>
          ))}
        </fieldset>

        {candidates.isError ? <Notice tone="red">{errorMessage(candidates.error, "Candidates could not be loaded.")}</Notice> : null}
        {candidates.isLoading ? <LoadingRows /> : (
          <>
            <p className="text-xs text-muted-foreground">
              {rows.length} match · {rows.length - open.length} already have it · {selected.length} ticked
            </p>
            {rows.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <input type="checkbox" aria-label="Tick everyone who does not have it yet" disabled={!open.length || !editable}
                        checked={open.length > 0 && selected.length === open.length}
                        onChange={(event) => setPicked(event.target.checked ? new Set(open.map((row) => row.member_id)) : new Set())} />
                    </TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Status</TableHead>
                    {showPlacement ? <TableHead>Placement printed</TableHead> : null}
                    {badge ? <TableHead>Own image</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.member_id}>
                      <TableCell>
                        <input type="checkbox" aria-label={`Tick ${row.name}`} disabled={Boolean(row.issued) || !editable} checked={picked.has(row.member_id)}
                          onChange={(event) => setPicked((current) => {
                            const next = new Set(current)
                            if (event.target.checked) next.add(row.member_id)
                            else next.delete(row.member_id)
                            return next
                          })} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{row.name}{row.role === "leader" ? <span className="text-muted-foreground"> · leader</span> : null}</span>
                          <span className="text-xs text-muted-foreground">{row.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{row.team_name}</span>
                          <span className="text-xs text-muted-foreground">{row.team_id}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-wrap gap-1">
                          {row.issued ? <StatusBadge status={row.issued.status} label={`issued · ${row.issued.status.toLowerCase()}`} /> : null}
                          {row.submitted ? <Badge tone="green">submitted</Badge> : null}
                          {row.finalist ? <Badge tone="blue">finalist</Badge> : null}
                          {row.checked_in ? <Badge tone="green">checked in</Badge> : null}
                          {row.awards.map((award) => <Badge key={`${award.label}-${award.track}`} tone="amber">{award.label}{award.track ? ` · ${award.track}` : ""}</Badge>)}
                        </span>
                      </TableCell>
                      {showPlacement ? (
                        <TableCell>
                          <TextInput value={placements[row.member_id] ?? row.placement} maxLength={120} disabled={Boolean(row.issued) || !editable}
                            aria-label={`Placement for ${row.name}`} placeholder="e.g. Winner"
                            onChange={(event) => setPlacements((current) => ({ ...current, [row.member_id]: event.target.value }))} />
                        </TableCell>
                      ) : null}
                      {badge ? (
                        <TableCell>
                          <OwnImage image={images[row.member_id]?.url} disabled={Boolean(row.issued) || !editable}
                            onPick={(file) => void ownImage(row.member_id, file)}
                            onClear={() => setImages((current) => { const next = { ...current }; delete next[row.member_id]; return next })} />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <Empty>Nobody matches these filters.</Empty>}
          </>
        )}
      </div>
    </Panel>
  )
}

function OwnImage({ image, disabled, onPick, onClear }: { image?: string; disabled: boolean; onPick: (file: File | undefined) => void; onClear: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <span className="flex items-center gap-1">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- just-uploaded bucket URL
        <img src={image} alt="" className="size-8 rounded bg-muted object-contain" />
      ) : null}
      <input ref={input} type="file" accept={IMAGE_TYPES.join(",")} className="hidden" onChange={(event) => { onPick(event.target.files?.[0]); event.target.value = "" }} />
      <Button disabled={disabled} onClick={() => input.current?.click()}>{image ? "Change" : "Upload"}</Button>
      {image ? <Button onClick={onClear}>Use badge image</Button> : null}
    </span>
  )
}

// ---- issued ----

function IssuedTab({ stage, types, badges, editable }: { stage: Stage; types: CertificateType[]; badges: BadgeDefinition[]; editable: boolean }) {
  const [target, setTarget] = useState<TargetValue>("")
  const [status, setStatus] = useState("")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  const search = new URLSearchParams({ page: String(page) })
  // A badge may be hackathon-wide (no event), so a chosen badge or type is filtered on its own.
  if (target.startsWith("cert:")) search.set("certificate_type_id", target.slice(5))
  else if (target.startsWith("badge:")) search.set("badge_definition_id", target.slice(6))
  else search.set("stage_id", stage.id)
  if (status) search.set("status", status)
  if (q.trim()) search.set("q", q.trim())
  const list = useQuery({
    queryKey: keys.credentials(search.toString()),
    queryFn: ({ signal }) => api<{ total: number; page: number; page_size: number; items: IssuedCredential[] }>(`/api/admin/credentials?${search.toString()}`, { signal }),
    // Certificates are drawn in the background; keep checking until every one has its file.
    refetchInterval: (query) => query.state.data?.items.some((item) => item.render_status === "PENDING") ? 3000 : 30_000,
  })
  const publish = useAdminMutation<Record<string, unknown>, { published: number; not_ready: number; emailed: number }>((body) => ({ path: "/api/admin/credentials/publish", body }), AREAS)
  const items = list.data?.items ?? []
  const drafts = items.filter((item) => item.status === "DRAFT")
  const selected = drafts.filter((item) => picked.has(item.id))
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.page_size)) : 1
  const blockedByCompletion = !stage.completed_at && (selected.some((item) => item.kind === "CERTIFICATE") || target.startsWith("cert:"))

  function runPublish(body: Record<string, unknown>) {
    void publish.mutateAsync(body).then((result) => {
      toast.success(`${result.published} published, ${result.emailed} people emailed${result.not_ready ? `; ${result.not_ready} still being drawn, publish them again shortly` : ""}.`)
      setPicked(new Set())
    }).catch((error) => toast.error(errorMessage(error)))
  }

  return (
    <Panel
      title="Issued credentials"
      description={list.data ? `${list.data.total} total` : undefined}
      actions={editable ? (
        <span className="flex flex-wrap items-center gap-2">
          <ConfirmButton tone="green" confirmLabel={`Publish ${selected.length} and email`} disabled={!selected.length || publish.isPending}
            onConfirm={() => runPublish({ ids: selected.map((item) => item.id) })}>Publish selected ({selected.length})</ConfirmButton>
          {target ? (
            <ConfirmButton tone="green" confirmLabel="Publish every draft and email" disabled={publish.isPending}
              onConfirm={() => runPublish(target.startsWith("cert:") ? { certificate_type_id: target.slice(5) } : { badge_definition_id: target.slice(6) })}>
              Publish all drafts of this {target.startsWith("cert:") ? "type" : "badge"}
            </ConfirmButton>
          ) : null}
        </span>
      ) : null}
    >
      <div className="flex flex-col gap-3">
        <div className="grid items-start gap-3 md:grid-cols-3">
          <Field label="Show">
            <Select value={target} onChange={(event) => { setTarget(event.target.value as TargetValue); setPage(1); setPicked(new Set()) }}>
              <option value="">Everything in {stage.name}</option>
              {types.length ? <optgroup label="Certificates">{types.map((item) => <option key={item.id} value={`cert:${item.id}`}>{item.name}</option>)}</optgroup> : null}
              {badges.length ? <optgroup label="Badges">{badges.map((item) => <option key={item.id} value={`badge:${item.id}`}>{item.name}</option>)}</optgroup> : null}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
              <option value="">Any</option>
              <option value="DRAFT">Drafts</option>
              <option value="PUBLISHED">Published</option>
              <option value="REVOKED">Revoked</option>
            </Select>
          </Field>
          <Field label="Search name, email, team or credential ID">
            <TextInput value={q} maxLength={200} onChange={(event) => { setQ(event.target.value); setPage(1) }} />
          </Field>
        </div>
        {blockedByCompletion ? <Notice tone="amber">{stage.name} is not marked completed, so its certificates cannot be published yet. Badges can.</Notice> : null}
        {list.isError ? <Notice tone="red">{errorMessage(list.error, "Credentials could not be loaded.")}</Notice> : null}
        {list.isLoading ? <LoadingRows /> : items.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input type="checkbox" aria-label="Tick every draft on this page" disabled={!drafts.length || !editable}
                    checked={drafts.length > 0 && selected.length === drafts.length}
                    onChange={(event) => setPicked(event.target.checked ? new Set(drafts.map((item) => item.id)) : new Set())} />
                </TableHead>
                <TableHead>Credential</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Files</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <CredentialRow key={item.id} item={item} editable={editable} picked={picked.has(item.id)} expanded={expanded === item.id}
                  onPick={(on) => setPicked((current) => { const next = new Set(current); if (on) next.add(item.id); else next.delete(item.id); return next })}
                  onExpand={() => setExpanded(expanded === item.id ? null : item.id)} />
              ))}
            </TableBody>
          </Table>
        ) : <Empty>Nothing issued yet. Use the Issue tab.</Empty>}
        {pages > 1 ? (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span>Page {page} of {pages}</span>
            <Button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        ) : null}
      </div>
    </Panel>
  )
}

function CredentialRow({ item, editable, picked, expanded, onPick, onExpand }: {
  item: IssuedCredential
  editable: boolean
  picked: boolean
  expanded: boolean
  onPick: (on: boolean) => void
  onExpand: () => void
}) {
  const [form, setForm] = useState({ recipient_name: item.recipient_name, team_name: item.team_name, placement: item.placement, track: item.track })
  const [reason, setReason] = useState("")
  const save = useAdminMutation<Record<string, unknown>>((body) => ({ path: `/api/admin/credentials/${item.id}`, method: "PATCH", body }), AREAS)
  const revoke = useAdminMutation<string>((text) => ({ path: `/api/admin/credentials/${item.id}/revoke`, body: { reason: text } }), AREAS)
  const remove = useAdminMutation<void>(() => ({ path: `/api/admin/credentials/${item.id}`, method: "DELETE" }), AREAS)
  const dirty = form.recipient_name !== item.recipient_name || form.team_name !== item.team_name || form.placement !== item.placement || form.track !== item.track

  return (
    <>
      <TableRow>
        <TableCell>
          <input type="checkbox" aria-label={`Tick ${item.code}`} disabled={item.status !== "DRAFT" || !editable} checked={picked} onChange={(event) => onPick(event.target.checked)} />
        </TableCell>
        <TableCell>
          <div className="flex flex-col">
            <span>{item.title}{item.placement ? <span className="text-muted-foreground"> · {item.placement}</span> : null}</span>
            <span className="font-mono text-xs text-muted-foreground">{item.code}{item.version > 1 ? ` · v${item.version}` : ""}</span>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-col">
            <span>{item.recipient_name}</span>
            <span className="text-xs text-muted-foreground">{item.team_name} · {item.recipient_email}</span>
          </div>
        </TableCell>
        <TableCell>
          <span className="flex flex-wrap gap-1">
            <StatusBadge status={item.status} />
            {item.render_status === "PENDING" ? <Badge tone="amber">drawing…</Badge> : null}
            {item.render_status === "FAILED" ? <Badge tone="red">drawing failed</Badge> : null}
          </span>
          {item.render_error ? <span className="block text-xs text-red-600">{item.render_error}</span> : null}
          {item.revoked_reason ? <span className="block text-xs text-muted-foreground">Revoked: {item.revoked_reason}</span> : null}
        </TableCell>
        <TableCell>
          <span className="flex flex-wrap gap-2 text-sm">
            {item.image_url ? <a href={item.image_url} target="_blank" rel="noreferrer" className="underline">Image</a> : null}
            {item.pdf_url ? <a href={item.pdf_url} target="_blank" rel="noreferrer" className="underline">PDF</a> : null}
            {item.status !== "DRAFT" ? <a href={item.verify_url} target="_blank" rel="noreferrer" className="underline">Verify page</a> : null}
          </span>
        </TableCell>
        <TableCell>
          {editable && item.status !== "REVOKED" ? <Button onClick={onExpand}>{expanded ? "Close" : "Manage"}</Button> : null}
        </TableCell>
      </TableRow>
      {expanded && editable ? (
        <TableRow>
          <TableCell colSpan={6}>
            <div className="flex flex-col gap-3 py-2">
              <p className="text-xs text-muted-foreground">Corrections keep the same credential ID; certificates are redrawn as a new version.</p>
              <div className="grid items-start gap-3 md:grid-cols-4">
                <Field label="Name printed">
                  <TextInput value={form.recipient_name} maxLength={200} onChange={(event) => setForm({ ...form, recipient_name: event.target.value })} />
                </Field>
                <Field label="Team name">
                  <TextInput value={form.team_name} maxLength={200} onChange={(event) => setForm({ ...form, team_name: event.target.value })} />
                </Field>
                <Field label="Placement">
                  <TextInput value={form.placement} maxLength={120} onChange={(event) => setForm({ ...form, placement: event.target.value })} />
                </Field>
                <Field label="Track">
                  <TextInput value={form.track} maxLength={200} onChange={(event) => setForm({ ...form, track: event.target.value })} />
                </Field>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Button tone="green" disabled={!dirty || !form.recipient_name.trim() || save.isPending}
                  onClick={() => void notify(save.mutateAsync(form), item.kind === "CERTIFICATE" ? "Saved; the certificate is being redrawn." : "Saved.")}>
                  Save correction
                </Button>
                {item.status === "DRAFT" ? (
                  <ConfirmButton confirmLabel="Delete draft" disabled={remove.isPending} onConfirm={() => void notify(remove.mutateAsync(), "Draft deleted.")}>Delete draft</ConfirmButton>
                ) : (
                  <>
                    <Field label="Reason for revoking (kept in the audit log)">
                      <TextInput value={reason} maxLength={500} className="w-72" onChange={(event) => setReason(event.target.value)} />
                    </Field>
                    <ConfirmButton confirmLabel="Revoke for good" disabled={reason.trim().length < 3 || revoke.isPending}
                      onConfirm={() => void notify(revoke.mutateAsync(reason.trim()), "Credential revoked; its verify page now says so.")}>Revoke</ConfirmButton>
                  </>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}
