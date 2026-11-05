"use client"

import { useState } from "react"

import { Badge, Button, ConfirmButton, Field, Notice, Select, TextArea, TextInput } from "@/components/admin/kit"
import { errorMessage } from "@/lib/api"
import { notify } from "@/lib/notify"
import { useAdminMutation, useAdminQuery } from "@/lib/queries"

export type FormFieldType = "short_text" | "long_text" | "url" | "number" | "select" | "multi_select" | "checkbox" | "github"
export type FormField = {
  key: string
  builtin: boolean
  type: FormFieldType
  label: string
  hint: string
  required: boolean
  enabled?: boolean
  show_to_judges?: boolean
  archived?: boolean
  options?: string[]
  max_length?: number
}
type FormPayload = { stage_id: string; customized: boolean; fields: FormField[]; submitted: number; answered_keys: string[]; defaults: FormField[] }

const TYPES: Record<Exclude<FormFieldType, "github">, string> = {
  short_text: "Short text",
  long_text: "Long text",
  url: "Link",
  number: "Number",
  select: "Dropdown (one)",
  multi_select: "Checkboxes (several)",
  checkbox: "Yes / no tick",
}
const TEXT_LIMITS: Partial<Record<FormFieldType, number>> = { short_text: 500, long_text: 5000 }
const KEY = /^[a-z][a-z0-9_]{0,39}$/

function keyFor(label: string, taken: string[]) {
  const base = (label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "") || "question").slice(0, 34)
  let key = base
  for (let index = 2; taken.includes(key); index += 1) key = `${base}_${index}`
  return key
}

/**
 * The fields teams fill in on their dashboard for one event. Built-in fields can be hidden, renamed
 * or made optional (the project name always stays); custom questions are added below them.
 */
export function SubmissionFormBuilder({ stageId, editable }: { stageId: string; editable: boolean }) {
  const [open, setOpen] = useState(false)
  const form = useAdminQuery<FormPayload>(["submission-form", stageId], open ? `/api/admin/stages/${stageId}/submission-form` : null)
  return (
    <div className="grid gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">Submission form</p>
          <p className="text-xs text-muted-foreground">The fields teams fill in for this event. Judges see the answers you allow; every answer is in the Submissions CSV.</p>
        </div>
        <Button onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Hide" : editable ? "Edit form" : "View form"}</Button>
      </div>
      {open ? (
        form.isError ? <Notice tone="red">{errorMessage(form.error, "The form could not be loaded.")}</Notice>
          : !form.data ? <p className="text-sm text-muted-foreground">Loading…</p>
            : <Builder key={JSON.stringify(form.data.fields)} data={form.data} stageId={stageId} editable={editable} />
      ) : null}
    </div>
  )
}

function Builder({ data, stageId, editable }: { data: FormPayload; stageId: string; editable: boolean }) {
  const areas = [["submission-form", stageId], ["stages"], ["submissions"]]
  const save = useAdminMutation<{ fields: FormField[] }>((body) => ({ path: `/api/admin/stages/${stageId}/submission-form`, method: "PUT", body }), areas)
  const reset = useAdminMutation<void>(() => ({ path: `/api/admin/stages/${stageId}/submission-form`, method: "DELETE" }), areas)
  const [fields, setFields] = useState<FormField[]>(data.fields)
  const answered = new Set(data.answered_keys)
  const savedKeys = new Set(data.fields.map((item) => item.key))
  const visible = fields.filter((item) => !item.archived)
  const removed = fields.filter((item) => item.archived)
  const dirty = JSON.stringify(fields) !== JSON.stringify(data.fields)
  const newRequired = fields.filter((item) => item.required && !item.archived && (item.builtin ? item.enabled !== false : true)
    && !data.fields.some((old) => old.key === item.key && old.required && (old.builtin ? old.enabled !== false : !old.archived)))
  const problems = visible.flatMap((item) => {
    if (!item.label.trim()) return [`Every field needs a question (${item.key}).`]
    if (!item.builtin && !KEY.test(item.key)) return [`${item.label}: invalid key.`]
    if ((item.type === "select" || item.type === "multi_select") && !(item.options ?? []).filter((option) => option.trim()).length) return [`${item.label}: add at least one option.`]
    if ((item.type === "select" || item.type === "multi_select") && new Set((item.options ?? []).map((option) => option.trim())).size !== (item.options ?? []).length) return [`${item.label}: options must be different.`]
    return []
  })
  const customCount = visible.filter((item) => !item.builtin).length

  function patch(key: string, change: Partial<FormField>) {
    setFields(fields.map((item) => (item.key === key ? { ...item, ...change } : item)))
  }

  function move(key: string, by: number) {
    const index = fields.findIndex((item) => item.key === key)
    let target = index + by
    while (fields[target]?.archived) target += by
    if (target < 0 || target >= fields.length) return
    const next = [...fields]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    setFields(next)
  }

  function remove(item: FormField) {
    // Answered questions are kept (archived) so no team's answer is lost; unanswered ones just go.
    if (answered.has(item.key)) patch(item.key, { archived: true, required: false })
    else setFields(fields.filter((field) => field.key !== item.key))
  }

  function add() {
    const key = keyFor("question", fields.map((item) => item.key))
    setFields([...fields, { key, builtin: false, type: "short_text", label: "", hint: "", required: false, show_to_judges: true, max_length: 200 }])
  }

  function body(): FormField[] {
    return fields.map((item) => ({
      ...item,
      label: item.label.trim(),
      hint: item.hint.trim(),
      ...(item.options ? { options: item.options.map((option) => option.trim()).filter(Boolean) } : {}),
    }))
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="grid gap-2">
        {data.submitted && newRequired.length ? (
          <Notice tone="amber">
            {data.submitted} team{data.submitted === 1 ? " has" : "s have"} already submitted and won&apos;t be asked for {newRequired.map((item) => `"${item.label || item.key}"`).join(", ")}. Only drafts and new submissions need it.
          </Notice>
        ) : null}
        {visible.map((item, index) => (
          <FieldRow key={item.key} item={item} first={index === 0} last={index === visible.length - 1} editable={editable}
            locked={!item.builtin && answered.has(item.key) && savedKeys.has(item.key)}
            onChange={(change) => patch(item.key, change)}
            onMove={(by) => move(item.key, by)}
            onRemove={() => remove(item)}
            onKey={(label) => {
              // New questions follow their label until saved; saved keys never change (answers hang on them).
              if (!savedKeys.has(item.key)) patch(item.key, { label, key: keyFor(label, fields.filter((field) => field.key !== item.key).map((field) => field.key)) })
              else patch(item.key, { label })
            }} />
        ))}
        {removed.length ? (
          <div className="rounded-lg border border-dashed border-border p-2 text-xs text-muted-foreground">
            Removed but kept because teams answered them (still in the CSV and on the Submissions page):{" "}
            {removed.map((item) => (
              <span key={item.key} className="mr-2 inline-flex items-center gap-1">
                {item.label}
                {editable ? <button type="button" className="underline" onClick={() => patch(item.key, { archived: false })}>restore</button> : null}
              </span>
            ))}
          </div>
        ) : null}
        {problems.length ? <p className="text-xs text-red-600">{problems[0]}</p> : null}
        {editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={customCount >= 20} onClick={add}>Add question</Button>
            <Button tone="green" disabled={!dirty || problems.length > 0 || save.isPending}
              onClick={() => void notify(save.mutateAsync({ fields: body() }), "Submission form saved. Teams see it on their dashboard now.")}>
              {save.isPending ? "Saving…" : "Save form"}
            </Button>
            {dirty ? <Button onClick={() => setFields(data.fields)}>Discard changes</Button> : null}
            {data.customized && !data.answered_keys.some((key) => data.fields.some((item) => item.key === key && !item.builtin)) ? (
              <ConfirmButton confirmLabel="Back to the default form" disabled={reset.isPending}
                onConfirm={() => void notify(reset.mutateAsync(undefined), "Form reset to the default.")}>Reset</ConfirmButton>
            ) : null}
            <span className="text-xs text-muted-foreground">{customCount}/20 custom questions</span>
          </div>
        ) : null}
      </div>
      <Preview fields={visible} />
    </div>
  )
}

function FieldRow({ item, first, last, editable, locked, onChange, onMove, onRemove, onKey }: {
  item: FormField
  first: boolean
  last: boolean
  editable: boolean
  /** Teams answered it, so its type is fixed. */
  locked: boolean
  onChange: (change: Partial<FormField>) => void
  onMove: (by: number) => void
  onRemove: () => void
  onKey: (label: string) => void
}) {
  const fixedName = item.key === "project_name"
  const off = item.builtin && item.enabled === false
  return (
    <div className={`grid gap-2 rounded-lg border border-border p-2 ${off ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        {item.builtin ? <Badge>built-in</Badge> : <Badge tone="amber">custom</Badge>}
        <span className="text-xs text-muted-foreground">{item.builtin ? (item.type === "github" ? "GitHub link" : item.type === "url" ? "Link" : item.type === "long_text" ? "Long text" : "Short text") : TYPES[item.type as keyof typeof TYPES]}</span>
        {editable ? (
          <span className="ml-auto flex gap-1">
            <Button aria-label="Move up" disabled={first} onClick={() => onMove(-1)}>↑</Button>
            <Button aria-label="Move down" disabled={last} onClick={() => onMove(1)}>↓</Button>
            {!item.builtin ? <Button aria-label={`Remove ${item.label || "question"}`} onClick={onRemove}>✕</Button> : null}
          </span>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Question">
          <TextInput value={item.label} maxLength={120} disabled={!editable || off} placeholder="e.g. Tech stack" onChange={(event) => onKey(event.target.value)} />
        </Field>
        <Field label="Help text (optional)">
          <TextInput value={item.hint} maxLength={300} disabled={!editable || off} onChange={(event) => onChange({ hint: event.target.value })} />
        </Field>
        {!item.builtin ? (
          <Field label="Answer type" hint={locked ? "Teams have answered it, so the type is fixed." : undefined}>
            <Select value={item.type} disabled={!editable || locked}
              onChange={(event) => {
                const type = event.target.value as FormFieldType
                onChange({
                  type,
                  options: type === "select" || type === "multi_select" ? item.options?.length ? item.options : ["Option 1"] : undefined,
                  max_length: TEXT_LIMITS[type] ? Math.min(item.max_length ?? (type === "long_text" ? 2000 : 200), TEXT_LIMITS[type] as number) : undefined,
                })
              }}>
              {Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
        ) : null}
        {!item.builtin && TEXT_LIMITS[item.type] ? (
          <Field label="Max characters">
            <TextInput type="number" min={1} max={TEXT_LIMITS[item.type]} value={item.max_length ?? 200} disabled={!editable}
              onChange={(event) => onChange({ max_length: Math.max(1, Math.min(Number(event.target.value) || 1, TEXT_LIMITS[item.type] as number)) })} />
          </Field>
        ) : null}
        {item.type === "select" || item.type === "multi_select" ? (
          <div className="sm:col-span-2">
            <Field label="Options (one per line)">
              <TextArea value={(item.options ?? []).join("\n")} disabled={!editable} className="min-h-16"
                onChange={(event) => onChange({ options: event.target.value.split("\n").slice(0, 30) })} />
            </Field>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        {item.builtin && !fixedName ? (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={item.enabled !== false} disabled={!editable} onChange={(event) => onChange({ enabled: event.target.checked, required: event.target.checked && item.required })} />
            Show this field
          </label>
        ) : null}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={item.required} disabled={!editable || fixedName || off} onChange={(event) => onChange({ required: event.target.checked })} />
          Required to submit{fixedName ? " (always)" : ""}
        </label>
        {!item.builtin ? (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={item.show_to_judges !== false} disabled={!editable} onChange={(event) => onChange({ show_to_judges: event.target.checked })} />
            Judges can see the answer
          </label>
        ) : null}
      </div>
    </div>
  )
}

/** Roughly what a team sees on its dashboard. */
function Preview({ fields }: { fields: FormField[] }) {
  const shown = fields.filter((item) => !item.builtin || item.enabled !== false)
  return (
    <aside className="h-fit rounded-xl border border-border bg-muted/30 p-3 text-sm lg:sticky lg:top-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Team preview</p>
      <div className="grid gap-2.5">
        {shown.map((item) => (
          <div key={item.key} className="grid gap-1">
            <span className="text-xs">{item.label || "Untitled question"}{item.required ? " *" : ""}</span>
            {item.type === "long_text" ? <div className="h-12 rounded-md border border-border bg-card" />
              : item.type === "checkbox" ? <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-3.5 rounded border border-border bg-card" />{item.hint || "Tick to confirm"}</span>
                : item.type === "select" ? <div className="flex h-7 items-center rounded-md border border-border bg-card px-2 text-xs text-muted-foreground">{item.options?.[0] ?? "Choose…"} ▾</div>
                  : item.type === "multi_select" ? <div className="flex flex-wrap gap-1">{(item.options ?? []).slice(0, 4).map((option) => <span key={option} className="rounded border border-border bg-card px-1.5 text-xs">{option}</span>)}</div>
                    : <div className="h-7 rounded-md border border-border bg-card" />}
            {item.hint && item.type !== "checkbox" ? <span className="text-[11px] text-muted-foreground">{item.hint}</span> : null}
          </div>
        ))}
      </div>
    </aside>
  )
}
