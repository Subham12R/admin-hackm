"use client"

import { useState } from "react"

import { Badge, Button, ConfirmButton, Empty, Field, LoadingRows, Notice, Panel, StatusBadge, TextInput } from "@/components/admin/kit"
import { dateTime, errorMessage } from "@/lib/api"
import { notify } from "@/lib/notify"
import { keys, useAdminMutation, useAdminQuery } from "@/lib/queries"

type TeamInvite = {
  id: string
  email: string
  waive_payment: boolean
  status: "ACTIVE" | "USED" | "EXPIRED"
  expires_at: string
  created_at: string
  used_at: string | null
  team_name: string | null
  invited_by: string | null
}

const AREA = [keys.teamInvites]

/** Email a leader a 10-minute link that registers their team even while registration is closed. */
export function TeamInvites({ canInvite }: { canInvite: boolean }) {
  const invites = useAdminQuery<{ items: TeamInvite[] }>(keys.teamInvites, "/api/admin/team-invites", { refetchInterval: 30_000 })
  const send = useAdminMutation<{ email: string; waive_payment: boolean }>((body) => ({ path: "/api/admin/team-invites", body }), AREA)
  const remove = useAdminMutation<string>((id) => ({ path: `/api/admin/team-invites/${id}`, method: "DELETE" }), AREA)
  const [email, setEmail] = useState("")
  const [waive, setWaive] = useState(false)
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  return (
    <Panel title="Invite a team" description="Sends the leader a link that works for 10 minutes and skips the registration window. Waive the fee to register them without payment.">
      {canInvite ? (
        <form className="mb-4 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) void notify(send.mutateAsync({ email: email.trim(), waive_payment: waive }), `Invite sent to ${email.trim()}.`, () => { setEmail(""); setWaive(false) })
          }}>
          <Field label="Team leader email">
            <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="leader@example.com" className="w-72" />
          </Field>
          <label className="flex items-center gap-2 pb-1 text-sm">
            <input type="checkbox" checked={waive} onChange={(event) => setWaive(event.target.checked)} />
            Waive the entry fee
          </label>
          <Button type="submit" tone="green" disabled={!valid || send.isPending}>{send.isPending ? "Sending…" : "Send invite"}</Button>
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
                  {invite.waive_payment ? <Badge tone="green">fee waived</Badge> : null}
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
