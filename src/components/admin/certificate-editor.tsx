"use client"

import { useRef, useState, type CSSProperties, type PointerEvent } from "react"

import { Button, Field, Notice, Select, TextInput } from "@/components/admin/kit"
import { api, errorMessage } from "@/lib/api"
import {
  FIELD_LABELS,
  FIELD_SAMPLES,
  FONT_CSS,
  FONT_LABELS,
  newField,
  type CertificateType,
  type FieldKind,
  type LayoutField,
} from "@/lib/credentials"
import { notify } from "@/lib/notify"
import { cn } from "@/lib/utils"

const ADDABLE: FieldKind[] = ["recipient_name", "team_name", "stage_name", "event_name", "placement", "track", "issue_date", "credential_id", "text", "qr"]
const clamp = (value: number) => Math.min(1, Math.max(0, value))

function chipText(field: LayoutField) {
  if (field.field === "text") return field.text || "Fixed text"
  if (field.field === "credential_id") return `${field.prefix}${FIELD_SAMPLES.credential_id}`
  const sample = FIELD_SAMPLES[field.field]
  return field.uppercase ? sample.toUpperCase() : sample
}

function chipStyle(field: LayoutField): CSSProperties {
  const left = `${field.x * 100}%`
  const top = `${field.y * 100}%`
  if (field.field === "qr") {
    // Container query units: 1cqh is 1% of the artwork's height, the same base the server uses.
    return { left, top, width: `${field.size * 100}cqh`, height: `${field.size * 100}cqh` }
  }
  const font = FONT_CSS[field.font] ?? FONT_CSS.sans
  const shift = field.align === "left" ? "0%" : field.align === "right" ? "-100%" : "-50%"
  return {
    left, top, transform: `translate(${shift}, -50%)`, fontSize: `${field.size * 100}cqh`, color: field.color,
    fontFamily: font.family, fontWeight: font.weight, fontStyle: font.style, lineHeight: 1.1,
    maxWidth: field.max_width ? `${field.max_width * 100}cqw` : undefined,
  }
}

/**
 * Drag fields onto the uploaded artwork, tune them in the side panel, then check with the server's
 * preview (which draws with the real fonts and a real QR code) before saving.
 */
export function CertificateEditor({ item, fonts, editable, onSaved }: {
  item: CertificateType
  fonts: string[]
  editable: boolean
  onSaved: (layout: LayoutField[]) => Promise<unknown>
}) {
  const [layout, setLayout] = useState<LayoutField[]>(item.layout)
  const [selected, setSelected] = useState<number | null>(layout.length ? 0 : null)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const canvas = useRef<HTMLDivElement>(null)
  const drag = useRef<{ index: number; dx: number; dy: number } | null>(null)
  const dirty = JSON.stringify(layout) !== JSON.stringify(item.layout)
  const current = selected === null ? null : layout[selected]

  function patch(index: number, change: Partial<LayoutField>) {
    setLayout((fields) => fields.map((field, position) => position === index ? { ...field, ...change } : field))
  }

  function pointerDown(event: PointerEvent<HTMLButtonElement>, index: number) {
    setSelected(index)
    if (!editable || !canvas.current) return
    const box = canvas.current.getBoundingClientRect()
    const field = layout[index]
    drag.current = { index, dx: (event.clientX - box.left) / box.width - field.x, dy: (event.clientY - box.top) / box.height - field.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current || !canvas.current) return
    const box = canvas.current.getBoundingClientRect()
    const x = clamp((event.clientX - box.left) / box.width - drag.current.dx)
    const y = clamp((event.clientY - box.top) / box.height - drag.current.dy)
    patch(drag.current.index, { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 })
  }

  async function runPreview() {
    setPreviewing(true)
    setPreviewError(null)
    try {
      const result = await api<{ image: string }>(`/api/admin/certificate-types/${item.id}/preview`, { method: "POST", body: { layout } })
      setPreview(result.image)
    } catch (error) {
      setPreviewError(errorMessage(error, "The preview could not be drawn."))
    } finally {
      setPreviewing(false)
    }
  }

  async function save() {
    setSaving(true)
    await notify(onSaved(layout), "Layout saved. Issue new certificates, or redraw issued ones to apply it.")
    setSaving(false)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <div
          ref={canvas}
          className="relative w-full overflow-hidden rounded-lg border border-border bg-muted select-none"
          style={{ aspectRatio: `${item.width} / ${item.height}`, containerType: "size" }}
          onPointerDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}
        >
          {item.background_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- bucket URL, shown at the editor's size
            <img src={item.background_url} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full object-fill" />
          ) : null}
          {layout.map((field, index) => (
            <button
              key={index}
              type="button"
              aria-label={`${FIELD_LABELS[field.field]}${editable ? ", drag to move" : ""}`}
              className={cn(
                "absolute whitespace-nowrap rounded-[2px] outline-offset-2",
                editable ? "cursor-move" : "cursor-default",
                selected === index ? "outline-2 outline-dashed outline-sky-500" : "outline-1 outline-dashed outline-black/25",
                field.field === "qr" && "grid place-items-center bg-white/80 text-[10px] font-semibold text-black"
              )}
              style={chipStyle(field)}
              onPointerDown={(event) => pointerDown(event, index)}
              onPointerMove={pointerMove}
              onPointerUp={() => { drag.current = null }}
              onKeyDown={(event) => {
                if (!editable) return
                const step = event.shiftKey ? 0.01 : 0.002
                const moves: Record<string, Partial<LayoutField>> = {
                  ArrowLeft: { x: clamp(field.x - step) }, ArrowRight: { x: clamp(field.x + step) },
                  ArrowUp: { y: clamp(field.y - step) }, ArrowDown: { y: clamp(field.y + step) },
                }
                if (moves[event.key]) { event.preventDefault(); patch(index, moves[event.key]) }
              }}
            >
              {field.field === "qr" ? "QR" : chipText(field)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Drag fields into place (arrow keys nudge the selected one; hold Shift for bigger steps). Fonts here are stand-ins; use Preview to see the real result.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={previewing} onClick={() => void runPreview()}>{previewing ? "Drawing…" : "Preview with sample data"}</Button>
          {editable ? <Button tone="green" disabled={!dirty || saving} onClick={() => void save()}>{saving ? "Saving…" : dirty ? "Save layout" : "Saved"}</Button> : null}
          {editable && dirty ? <Button onClick={() => { setLayout(item.layout); setSelected(null) }}>Discard changes</Button> : null}
        </div>
        {previewError ? <Notice tone="red">{previewError}</Notice> : null}
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL from the preview endpoint
          <img src={preview} alt="Server preview of the certificate" className="w-full rounded-lg border border-border" />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {editable ? (
          <Field label="Add a field">
            <Select value="" onChange={(event) => {
              const kind = event.target.value as FieldKind
              if (!kind) return
              setLayout((fields) => [...fields, newField(kind)])
              setSelected(layout.length)
            }}>
              <option value="">Choose…</option>
              {ADDABLE.map((kind) => <option key={kind} value={kind}>{FIELD_LABELS[kind]}</option>)}
            </Select>
          </Field>
        ) : null}

        {current && selected !== null ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
            <p className="text-sm font-medium">{FIELD_LABELS[current.field]}</p>
            {current.field === "text" ? (
              <Field label="Text">
                <TextInput value={current.text} maxLength={200} disabled={!editable} onChange={(event) => patch(selected, { text: event.target.value })} />
              </Field>
            ) : null}
            {current.field === "credential_id" ? (
              <Field label="Label before the ID">
                <TextInput value={current.prefix} maxLength={40} disabled={!editable} onChange={(event) => patch(selected, { prefix: event.target.value })} />
              </Field>
            ) : null}
            <Field label={current.field === "qr" ? `Size: ${Math.round(current.size * 100)}% of the height` : `Text size: ${(current.size * 100).toFixed(1)}% of the height`}>
              <input type="range" min={current.field === "qr" ? 0.05 : 0.01} max={current.field === "qr" ? 0.4 : 0.15} step={0.001}
                value={current.size} disabled={!editable} onChange={(event) => patch(selected, { size: Number(event.target.value) })} />
            </Field>
            {current.field !== "qr" ? (
              <>
                <Field label="Font">
                  <Select value={current.font} disabled={!editable} onChange={(event) => patch(selected, { font: event.target.value })}>
                    {fonts.map((font) => <option key={font} value={font}>{FONT_LABELS[font] ?? font}</option>)}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Colour">
                    <input type="color" value={current.color.length === 7 ? current.color : "#000000"} disabled={!editable}
                      className="h-8 w-full rounded-md border border-border bg-card" onChange={(event) => patch(selected, { color: event.target.value })} />
                  </Field>
                  <Field label="Anchor">
                    <Select value={current.align} disabled={!editable} onChange={(event) => patch(selected, { align: event.target.value as LayoutField["align"] })}>
                      <option value="left">Left edge</option>
                      <option value="center">Centre</option>
                      <option value="right">Right edge</option>
                    </Select>
                  </Field>
                </div>
                <Field label={current.max_width ? `Shrink to fit ${Math.round(current.max_width * 100)}% of the width` : "Shrink to fit: off"}
                  hint="Long names get smaller instead of running off the artwork.">
                  <input type="range" min={0} max={1} step={0.01} value={current.max_width} disabled={!editable}
                    onChange={(event) => patch(selected, { max_width: Number(event.target.value) })} />
                </Field>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={current.uppercase} disabled={!editable} onChange={(event) => patch(selected, { uppercase: event.target.checked })} />
                  Upper case
                </label>
              </>
            ) : <p className="text-xs text-muted-foreground">Links to the certificate&apos;s public verify page.</p>}
            {editable ? (
              <Button tone="red" onClick={() => { setLayout((fields) => fields.filter((_, position) => position !== selected)); setSelected(null) }}>
                Remove field
              </Button>
            ) : null}
          </div>
        ) : <p className="text-sm text-muted-foreground">Select a field on the artwork to edit it.</p>}
      </div>
    </div>
  )
}
