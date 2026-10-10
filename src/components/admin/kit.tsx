"use client"

import { useState, type ButtonHTMLAttributes, type ComponentProps, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react"

import { RichButton } from "@/components/rich-button"
import { cn } from "@/lib/utils"

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="admin-fade flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        <p className="text-sm tracking-tighter text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** The zinc frame + white card used across the admin pages. */
export function Panel({ title, description, actions, children, className }: {
  title?: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("admin-rise min-w-0 rounded-2xl bg-zinc-100 p-1", className)}>
      <div className="min-w-0 overflow-hidden rounded-xl bg-white p-3 sm:p-4">
        {title || actions ? (
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              {title ? <h2 className="text-lg font-semibold tracking-tight">{title}</h2> : null}
              {description ? <p className="text-sm tracking-tighter text-muted-foreground">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  )
}

const tones = {
  zinc: "bg-zinc-100 text-zinc-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700",
  blue: "bg-sky-50 text-sky-700",
} as const

export type Tone = keyof typeof tones

export function Badge({ tone = "zinc", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-xs tracking-tighter whitespace-nowrap", tones[tone])}>{children}</span>
}

export function statusTone(status: string): Tone {
  if (["PAID", "CAPTURED", "VERIFIED", "SUBMITTED", "PUBLISHED", "RELEASED", "PROCESSED", "SETTLED", "RESOLVED", "OPEN", "ACTIVE", "SENT"].includes(status)) return "green"
  if (["NEEDS_REVIEW", "REQUIRED", "RECHECK", "PENDING", "PAYMENT_PENDING", "DRAFT", "LOCKED", "NEW", "UNKNOWN", "REQUESTED"].includes(status)) return "amber"
  if (["FAILED", "DECLINED", "REJECTED", "REFUNDED", "CANCELLED", "ABANDONED", "DISABLED", "SPAM"].includes(status)) return "red"
  return "zinc"
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={statusTone(status)}>{label ?? status.replaceAll("_", " ").toLowerCase()}</Badge>
}

const control = "rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-500"

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
      <span className="leading-4">{label}</span>
      {children}
      {error ? <span className="text-[11px] text-red-600">{error}</span> : hint ? <span className="text-[11px] text-zinc-500">{hint}</span> : null}
    </label>
  )
}

/** Puts buttons on the same line as the inputs of neighbouring Fields; use in rows aligned with items-start. */
export function FieldAction({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 text-xs", className)}>
      <span aria-hidden="true" className="invisible hidden leading-4 sm:block">&nbsp;</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

export function TextInput(props: ComponentProps<"input">) {
  return <input {...props} className={cn(control, "h-8", props.className)} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(control, "min-h-24 py-1.5", props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(control, "h-8", props.className)} />
}

export function Button({ children, tone = "zinc", ...props }: { children: ReactNode; tone?: "zinc" | "green" | "red" | "amber" } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color">) {
  return (
    <RichButton type="button" color={tone} size="sm" {...props} className={cn("font-pixel-square tracking-tighter normal-case", props.className)}>
      {children}
    </RichButton>
  )
}

/** Two-step button for consequential actions (refund, release, cancel). */
export function ConfirmButton({ children, confirmLabel, onConfirm, disabled, tone = "red" }: {
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  disabled?: boolean
  tone?: "zinc" | "green" | "red" | "amber"
}) {
  const [armed, setArmed] = useState(false)
  if (!armed) return <Button tone={tone === "red" ? "zinc" : tone} disabled={disabled} onClick={() => setArmed(true)}>{children}</Button>
  return (
    <span className="inline-flex items-center gap-1">
      <Button tone={tone} disabled={disabled} onClick={() => { setArmed(false); onConfirm() }}>{confirmLabel}</Button>
      <Button onClick={() => setArmed(false)}>Keep</Button>
    </span>
  )
}

export function Notice({ tone = "zinc", children }: { tone?: Tone; children: ReactNode }) {
  return <p role={tone === "red" ? "alert" : "status"} className={cn("rounded-md px-3 py-2 text-sm tracking-tighter", tones[tone])}>{children}</p>
}

export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="space-y-2">
      {Array.from({ length: rows }, (_, index) => <div key={index} className="admin-shimmer h-5 w-full rounded" />)}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm tracking-tighter text-muted-foreground">{children}</p>
}
