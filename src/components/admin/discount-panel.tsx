"use client"

import { useState } from "react"

import { Button, Field, Panel, StatusBadge, TextInput } from "@/components/admin/kit"
import { dateTime, fromLocalInput, toLocalInput } from "@/lib/api"
import { notify } from "@/lib/notify"
import { useAdminMutation } from "@/lib/queries"

export type DiscountKind = "NONE" | "PERCENT" | "AMOUNT"
export type DiscountConfig = {
  kind: DiscountKind
  value: number
  label: string
  starts_at: string | null
  ends_at: string | null
  state: "OFF" | "SCHEDULED" | "ACTIVE" | "ENDED"
  active: boolean
}

const KINDS: { kind: DiscountKind; label: string; help: string }[] = [
  { kind: "NONE", label: "No discount", help: "Every team pays its normal price." },
  { kind: "PERCENT", label: "Percent off", help: "Takes a share off each team's price (₹200, ₹300 or ₹400)." },
  { kind: "AMOUNT", label: "Amount off", help: "Takes the same rupee amount off every team's price." },
]
// The tiers a discount applies to, cheapest last; mirrors the backend so the preview matches checkout.
const TIERS = [{ label: "Outside colleges", paise: 40000 }, { label: "ACM or Adamas", paise: 30000 }, { label: "Adamas + ACM", paise: 20000 }]
const MAX_PERCENT = 99
const MAX_AMOUNT_RUPEES = 199
const STATE_TEXT: Record<DiscountConfig["state"], string> = { OFF: "off", SCHEDULED: "scheduled", ACTIVE: "live now", ENDED: "ended" }

/** Same rounding as the backend: the discount comes off, the result is floored to a rupee and never below ₹1. */
export function discounted(paise: number, kind: DiscountKind, value: number) {
  if (paise <= 0 || !value || kind === "NONE") return paise
  const off = kind === "PERCENT" ? Math.floor((paise * value) / 100) : value
  return Math.max(100, Math.floor((paise - off) / 100) * 100)
}

function initialValue(config: DiscountConfig) {
  if (config.kind === "AMOUNT") return String(config.value / 100)
  if (config.kind === "PERCENT") return String(config.value)
  return ""
}

/** Remount with a new key whenever the saved discount changes, so background refetches keep unsaved edits. */
export function DiscountPanel({ config, editable, free = false }: { config: DiscountConfig; editable: boolean; free?: boolean }) {
  const save = useAdminMutation<Record<string, unknown>>((body) => ({ path: "/api/admin/event", method: "PATCH", body }), [["event"]])
  const [kind, setKind] = useState<DiscountKind>(config.kind)
  const [value, setValue] = useState(initialValue(config))
  const [label, setLabel] = useState(config.label)
  const [starts, setStarts] = useState(toLocalInput(config.starts_at))
  const [ends, setEnds] = useState(toLocalInput(config.ends_at))

  const number = Number(value)
  const valueError = kind === "NONE" ? "" : !value.trim() || !Number.isInteger(number)
    ? "Use a whole number"
    : kind === "PERCENT" && (number < 1 || number > MAX_PERCENT) ? `Between 1 and ${MAX_PERCENT}`
    : kind === "AMOUNT" && (number < 1 || number > MAX_AMOUNT_RUPEES) ? `Between ₹1 and ₹${MAX_AMOUNT_RUPEES} (below the cheapest price)` : ""
  const windowError = starts && ends && starts >= ends ? "The end must be after the start" : ""
  const valueMinor = kind === "AMOUNT" ? number * 100 : number
  const dirty = kind !== config.kind || (kind !== "NONE" && (valueMinor !== config.value || label.trim() !== config.label
    || starts !== toLocalInput(config.starts_at) || ends !== toLocalInput(config.ends_at)))

  function submit() {
    const body = kind === "NONE"
      ? { discount_kind: "NONE" }
      : { discount_kind: kind, discount_value: valueMinor, discount_label: label.trim(), discount_starts_at: fromLocalInput(starts), discount_ends_at: fromLocalInput(ends) }
    void notify(save.mutateAsync(body), kind === "NONE" ? "Discount switched off." : "Discount saved. New registrations get it inside its window.")
  }

  return (
    <Panel
      title="Discount"
      description={summary(config)}
      className="md:col-span-3"
      actions={editable ? (
        <Button tone="green" disabled={save.isPending || !dirty || Boolean(valueError || windowError)} onClick={submit}>{save.isPending ? "Saving…" : "Save discount"}</Button>
      ) : null}
    >
      <div className="flex flex-col gap-3">
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={config.state === "ACTIVE" ? "ACTIVE" : config.state === "SCHEDULED" ? "PENDING" : "CLOSED"} label={`discount ${STATE_TEXT[config.state]}`} />
        </span>
        <div role="radiogroup" aria-label="Discount type" className="grid gap-2 sm:grid-cols-3">
          {KINDS.map((option) => (
            <button key={option.kind} type="button" role="radio" aria-checked={kind === option.kind} disabled={!editable || save.isPending}
              onClick={() => { setKind(option.kind); setValue(option.kind === config.kind ? initialValue(config) : "") }}
              className={`rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed ${kind === option.kind ? "border-foreground bg-foreground/5" : "border-border hover:bg-muted/50"}`}>
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.help}</span>
            </button>
          ))}
        </div>
        {kind !== "NONE" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
              <Field label={kind === "PERCENT" ? "Percent off" : "Amount off (₹)"} error={value ? valueError || undefined : undefined}
                hint={kind === "PERCENT" ? `1 to ${MAX_PERCENT}` : `₹1 to ₹${MAX_AMOUNT_RUPEES}`}>
                <TextInput type="number" inputMode="numeric" min={1} max={kind === "PERCENT" ? MAX_PERCENT : MAX_AMOUNT_RUPEES} step={1} value={value}
                  disabled={!editable} onChange={(event) => setValue(event.target.value)} placeholder={kind === "PERCENT" ? "20" : "50"} />
              </Field>
              <Field label="Label shown to teams" hint="Optional, e.g. Early bird">
                <TextInput value={label} maxLength={60} disabled={!editable} onChange={(event) => setLabel(event.target.value)} placeholder="Early bird" />
              </Field>
              <Field label="Starts (IST)" hint="Empty means from now">
                <span className="flex gap-1">
                  <TextInput type="datetime-local" value={starts} disabled={!editable} onChange={(event) => setStarts(event.target.value)} className="flex-1" />
                  {editable && starts ? <Button onClick={() => setStarts("")} aria-label="Clear discount start">Clear</Button> : null}
                </span>
              </Field>
              <Field label="Ends (IST)" hint={windowError ? undefined : "Empty means until you switch it off"} error={windowError || undefined}>
                <span className="flex gap-1">
                  <TextInput type="datetime-local" value={ends} disabled={!editable} onChange={(event) => setEnds(event.target.value)} className="flex-1" />
                  {editable && ends ? <Button onClick={() => setEnds("")} aria-label="Clear discount end">Clear</Button> : null}
                </span>
              </Field>
            </div>
            {!valueError && value ? (
              <ul aria-label="What teams pay" className="grid gap-2 sm:grid-cols-3">
                {TIERS.map((tier) => (
                  <li key={tier.label} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    <span className="block text-xs text-muted-foreground">{tier.label}</span>
                    <s className="mr-1.5 text-muted-foreground">₹{tier.paise / 100}</s>
                    <span className="font-medium">₹{discounted(tier.paise, kind, valueMinor) / 100}</span>
                    <span className="text-xs text-muted-foreground"> + gateway charges</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
        {free ? <p className="text-xs text-amber-700 dark:text-amber-400">Registration is free right now, so no one is charged; a discount applies once entry is paid again.</p> : null}
        <p className="text-xs text-muted-foreground">
          Teams keep the price they registered with: ending the discount, or an ACM claim being rejected later, never takes it away. Invites with their own entry fee are not discounted.
        </p>
      </div>
    </Panel>
  )
}

function summary(config: DiscountConfig) {
  if (config.kind === "NONE" || config.state === "OFF") return "No discount is set."
  const amount = config.kind === "PERCENT" ? `${config.value}% off` : `₹${config.value / 100} off`
  const name = config.label ? `${config.label}: ${amount}` : amount
  if (config.state === "SCHEDULED") return `${name}, from ${dateTime(config.starts_at)}${config.ends_at ? ` until ${dateTime(config.ends_at)}` : ""}.`
  if (config.state === "ENDED") return `${name} ended ${dateTime(config.ends_at)}.`
  return `${name}, live now${config.ends_at ? ` until ${dateTime(config.ends_at)}` : ""}.`
}
