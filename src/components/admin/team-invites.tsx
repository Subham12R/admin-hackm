"use client"

import { useState } from "react"

import { Badge, Button, ConfirmButton, Empty, Field, FieldAction, LoadingRows, Notice, Panel, StatusBadge, TextInput } from "@/components/admin/kit"
import { dateTime, errorMessage, rupees } from "@/lib/api"
import { notify } from "@/lib/notify"
import { keys, useAdminMutation, useAdminQuery } from "@/lib/queries"

type TeamInvite = {
  id: string
  email: string
  waive_payment: boolean
  mode?: InviteMode
  price_minor?: number | null
  status: "ACTIVE" | "USED" | "EXPIRED"
  expires_at: string
  created_at: string
  used_at: string | null
  team_name: string | null
  invited_by: string | null
}

type InviteMode = "FREE" | "PAID"

const AREA = [keys.teamInvites]
const MODES: { mode: InviteMode; label: string; help: string }[] = [
  { mode: "FREE", label: "Free", help: "Registered on submit, no payment step." },
  { mode: "PAID", label: "Paid", help: "Pays at checkout: your fee below, or their normal price." },
]

/** Email a leader a 10-minute link that registers their team even while registration is closed. */
export function TeamInvites({ canInvite }: { canInvite: boolean }) {
  const invites = useAdminQuery<{ items: TeamInvite[] }>(keys.teamInvites, "/api/admin/team-invites", { refetchInterval: 30_000 })
  const send = useAdminMutation<{ email: string; mode: InviteMode; amount_minor?: number }>((body) => ({ path: "/api/admin/team-invites", body }), AREA)
  const remove = useAdminMutation<string>((id) => ({ path: `/api/admin/team-invites/${id}`, method: "DELETE" }), AREA)
  const [email, setEmail] = useState("")
  const [mode, setMode] = useState<InviteMode>("PAID")
  const [fee, setFee] = useState("")
  const feeNumber = Number(fee)
  const feeError = mode === "PAID" && fee.trim() && (!Number.isInteger(feeNumber) || feeNumber < 1 || feeNumber > 10000) ? "A whole number from ₹1 to ₹10,000" : ""
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && !feeError

  function reset() {
    setEmail("")
    setMode("PAID")
    setFee("")
  }

  function submit() {
    const body = { email: email.trim(), mode, ...(mode === "PAID" && fee.trim() ? { amount_minor: feeNumber * 100 } : {}) }
    const priced = mode === "FREE" ? "free entry" : fee.trim() ? `₹${feeNumber} + gateway charges` : "their normal price"
    void notify(send.mutateAsync(body), `Invite sent to ${email.trim()} (${priced}).`, reset)
  }

  return (
    <Panel title="Invite a team" description="Sends the leader a link that works for 10 minutes and skips the registration window. Choose free entry, or a paid entry at your own fee.">
      {canInvite ? (
        <form className="mb-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) submit()
          }}>
          <div role="radiogroup" aria-label="Invite entry" className="grid gap-2 sm:grid-cols-2">
            {MODES.map((option) => (
              <button key={option.mode} type="button" role="radio" aria-checked={mode === option.mode} onClick={() => setMode(option.mode)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${mode === option.mode ? "border-foreground bg-foreground/5" : "border-border hover:bg-muted/50"}`}>
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.help}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(16rem,1fr)_12rem_auto] sm:items-start">
            <Field label="Team leader email">
              <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="leader@example.com" />
            </Field>
            {mode === "PAID" ? (
              <Field label="Entry fee (₹)" hint="Empty = their normal price; gateway charges are added" error={feeError || undefined}>
                <TextInput type="number" inputMode="numeric" min={1} max={10000} step={1} value={fee} onChange={(event) => setFee(event.target.value)} placeholder="e.g. 150" />
              </Field>
            ) : <div className="hidden sm:block" />}
            <FieldAction>
              <Button type="submit" tone="green" disabled={!valid || send.isPending}>{send.isPending ? "Sending…" : "Send invite"}</Button>
            </FieldAction>
          </div>
        </form>
      ) : null}
      {invites.isError ? <Notice tone="red">{errorMessage(invites.error, "Invites could not be loaded.")}</Notice> : invites.isPending ? <LoadingRows /> : invites.data.items.length ? (
        <ul className="divide-y divide-border text-sm">
          {invites.data.items.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="truncate">{invite.email}</span>
                  <StatusBadge status={invite.status} />
                  {invite.waive_payment ? <Badge tone="green">free</Badge> : invite.price_minor ? <Badge tone="blue">{rupees(invite.price_minor)} + charges</Badge> : <Badge>normal price</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {invite.status === "USED"
                    ? `Registered ${invite.team_name ?? "a team"} · ${dateTime(invite.used_at ?? invite.created_at)}`
                    : `Sent ${dateTime(invite.created_at)}${invite.invited_by ? ` by ${invite.invited_by}` : ""} · ${invite.status === "EXPIRED" ? "expired" : "expires"} ${dateTime(invite.expires_at)}`}
                </p>
              </div>
              {canInvite && invite.status !== "USED" ? (
                <ConfirmButton confirmLabel={invite.status === "ACTIVE" ? "Revoke invite" : "Delete invite"} disabled={remove.isPending}
                  onConfirm={() => void notify(remove.mutateAsync(invite.id), "Invite deleted.")}>
                  {invite.status === "ACTIVE" ? "Revoke" : "Delete"}
                </ConfirmButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <Empty>No team invites sent yet.</Empty>}
    </Panel>
  )
}
