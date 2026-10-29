"use client"

import { useState } from "react"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge, Button, ConfirmButton, Empty, Field, LoadingRows, Notice, RegistrationBadge, StatusBadge, TextInput } from "@/components/admin/kit"
import { dateTime, errorMessage, rupees } from "@/lib/api"
import { can, keys, useAdminMutation, useAdminQuery, useMe } from "@/lib/queries"
import { notify } from "@/lib/notify"

export type RegistrationDetail = {
  registration_id: string
  team_id: string
  team_name: string
  leader_email: string
  status: string
  fee_waived?: boolean
  rejection_reason?: string | null
  rejected_at?: string | null
  category: string | null
  pricing_tier: string
  quoted_amount_minor: number
  effective_amount_minor: number
  captured_amount_minor: number
  refunded_amount_minor: number
  adjustment: { status: string; amount_minor: number }
  created_at: string
  members: {
    id: string
    name: string
    email: string
    phone: string
    college: string
    role: string
    is_acm_member: boolean
    acm_id: string | null
    acm_review_status: string
    acm_reviewed_at: string | null
    acm_reviewed_by: string | null
  }[]
  orders: { id: string; provider_order_id: string; purpose: string; amount_minor: number; status: string; created_at: string }[]
  payments: {
    id: string
    provider_payment_id: string
    provider_order_id: string
    amount_minor: number
    status: string
    review_reason: string | null
    method: string | null
    error_code: string | null
    error_description: string | null
    created_at: string
    refundable_minor: number
  }[]
  refunds: { id: string; payment_id: string; provider_refund_id: string | null; amount_minor: number; status: string; reason: string; created_at: string }[]
}

const REVIEW_REASONS: Record<string, string> = {
  amount_mismatch: "Amount did not match the order",
  duplicate_payment: "Second payment on an already paid order",
  cancelled_order: "Paid on an order that was replaced",
  registration_not_pending: "Registration was no longer awaiting payment",
  leader_already_paid: "Leader already has a paid team",
  unknown_order: "Order not found",
}

const MIN_MEMBERS = 2
const MAX_MEMBERS = 4

export const REGISTRATION_AREAS = [["registration"], ["registrations"], ["teams"], ["payments-review"], ["submissions"]]

export function RegistrationDrawer({ registrationId, onClose }: { registrationId: string | null; onClose: () => void }) {
  return (
    <Sheet open={registrationId !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full overflow-y-auto font-pixel-square sm:max-w-2xl data-[side=right]:sm:max-w-2xl">
        {registrationId ? <DrawerBody registrationId={registrationId} onDeleted={onClose} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function DrawerBody({ registrationId, onDeleted }: { registrationId: string; onDeleted: () => void }) {
  const me = useMe()
  const roles = me.data?.user.roles ?? []
  const detail = useAdminQuery<RegistrationDetail>(keys.registration(registrationId), `/api/admin/registrations/${registrationId}`)

  const acmReview = useAdminMutation<{ memberId: string; status: string }>(
    ({ memberId, status }) => ({ path: `/api/admin/teams/${registrationId}/members/${memberId}/acm-review`, body: { status } }),
    REGISTRATION_AREAS
  )
  const cancel = useAdminMutation<void>(() => ({ path: `/api/admin/registrations/${registrationId}/cancel` }), REGISTRATION_AREAS)
  const remove = useAdminMutation<void>(() => ({ path: `/api/admin/registrations/${registrationId}`, method: "DELETE" }), REGISTRATION_AREAS)
  const accept = useAdminMutation<string>((attemptId) => ({ path: `/api/admin/payments/${attemptId}/accept` }), REGISTRATION_AREAS)
  const removeMember = useAdminMutation<string>((memberId) => ({ path: `/api/admin/teams/${registrationId}/members/${memberId}`, method: "DELETE" }), REGISTRATION_AREAS)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  function report(promise: Promise<unknown>, success: string) {
    void notify(promise, success)
  }

  const data = detail.data
  if (detail.isError) return <div className="p-4"><Notice tone="red">{errorMessage(detail.error, "Registration could not be loaded.")}</Notice></div>
  if (!data) return <div className="p-4"><LoadingRows rows={6} /></div>
  // Organisers change a registered team's roster at any time, including after registration closes.
  const rosterEditable = data.status === "PAID" && can.review(roles)

  return (
    <div className="flex flex-col gap-5 p-4 pt-0">
      <SheetHeader className="px-0">
        <SheetTitle className="text-xl tracking-tight">{data.team_name}</SheetTitle>
        <SheetDescription className="tracking-tighter">
          {data.team_id} · {data.leader_email} · registered {dateTime(data.created_at)}
        </SheetDescription>
        <div className="flex flex-wrap gap-1.5">
          <RegistrationBadge status={data.status} feeWaived={data.fee_waived} />
          {data.category ? <Badge>{data.category}</Badge> : null}
          {data.adjustment.status !== "NONE" ? <StatusBadge status={data.adjustment.status} label={`balance ${data.adjustment.status.toLowerCase()}`} /> : null}
          {data.rejection_reason && data.status !== "REJECTED" ? <StatusBadge status="REJECTED" label="rejected" /> : null}
        </div>
      </SheetHeader>
      {data.rejection_reason ? (
        <Notice tone="red">Rejected{data.rejected_at ? ` ${dateTime(data.rejected_at)}` : ""}: {data.rejection_reason}</Notice>
      ) : null}


      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3 text-sm sm:grid-cols-4">
        <Amount label="Quoted" value={data.quoted_amount_minor} />
        <Amount label="Owed now" value={data.effective_amount_minor} />
        <Amount label="Captured" value={data.captured_amount_minor} />
        <Amount label="Refunded" value={data.refunded_amount_minor} />
      </dl>
      {data.adjustment.status === "REQUIRED" ? (
        <Notice tone="amber">The team owes {rupees(data.adjustment.amount_minor)} after ACM review. Final submission is blocked until it is paid from their dashboard.</Notice>
      ) : null}

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium tracking-tight">Members and ACM review</h3>
          {rosterEditable && data.members.length < MAX_MEMBERS && !adding ? <Button onClick={() => setAdding(true)}>Add member</Button> : null}
        </div>
        {rosterEditable ? (
          <p className="text-xs text-muted-foreground">
            Leaders add or remove members themselves only while registration is open, and each change sends their team back to review. Your changes here count as reviewed.
          </p>
        ) : null}
        <ul className="divide-y divide-border rounded-xl border border-border">
          {data.members.map((member) => (
            <li key={member.id} className="p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{member.name} {member.role === "leader" ? <Badge>leader</Badge> : null}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.email} · {member.phone} · {member.college}</p>
                  {member.is_acm_member ? (
                    <p className="text-xs text-muted-foreground">
                      ACM ID {member.acm_id ?? "—"} · <StatusBadge status={member.acm_review_status} />
                      {member.acm_reviewed_by ? ` by ${member.acm_reviewed_by}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  {member.is_acm_member && can.review(roles) ? (
                    <>
                      <Button tone="green" disabled={acmReview.isPending || member.acm_review_status === "VERIFIED"}
                        onClick={() => report(acmReview.mutateAsync({ memberId: member.id, status: "VERIFIED" }), "ACM membership verified.")}>Verify</Button>
                      <ConfirmButton confirmLabel="Reject claim" disabled={acmReview.isPending || member.acm_review_status === "REJECTED"}
                        onConfirm={() => report(acmReview.mutateAsync({ memberId: member.id, status: "REJECTED" }), "Claim rejected; the leader was emailed any balance due.")}>
                        Reject
                      </ConfirmButton>
                    </>
                  ) : null}
                  {rosterEditable && editing !== member.id ? <Button onClick={() => setEditing(member.id)}>Edit</Button> : null}
                  {rosterEditable && member.role !== "leader" && data.members.length > MIN_MEMBERS ? (
                    <ConfirmButton confirmLabel={`Remove ${member.name}`} disabled={removeMember.isPending}
                      onConfirm={() => report(removeMember.mutateAsync(member.id), `${member.name} was removed from the team.`)}>
                      Remove
                    </ConfirmButton>
                  ) : null}
                </div>
              </div>
              {editing === member.id ? <MemberForm registrationId={registrationId} member={member} onDone={() => setEditing(null)} /> : null}
            </li>
          ))}
        </ul>
        {adding ? <MemberForm registrationId={registrationId} onDone={() => setAdding(false)} /> : null}
      </section>

      <section className="space-y-2">
        <h3 className="font-medium tracking-tight">Payments</h3>
        {data.payments.length ? (
          <ul className="space-y-2">
            {data.payments.map((payment) => (
              <li key={payment.id} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{rupees(payment.amount_minor)} <StatusBadge status={payment.status} /></p>
                    <p className="text-xs text-muted-foreground">{payment.provider_payment_id} · {payment.method ?? "—"} · {dateTime(payment.created_at)}</p>
                    {payment.review_reason ? <p className="text-xs text-amber-800">{REVIEW_REASONS[payment.review_reason] ?? payment.review_reason}</p> : null}
                    {payment.error_description ? <p className="text-xs text-red-700">{payment.error_description}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {payment.status === "NEEDS_REVIEW" && can.money(roles) && ["cancelled_order", "registration_not_pending"].includes(payment.review_reason ?? "") ? (
                      <ConfirmButton tone="green" confirmLabel="Accept and register" disabled={accept.isPending}
                        onConfirm={() => report(accept.mutateAsync(payment.id), "Payment accepted; the team is registered.")}>
                        Accept payment
                      </ConfirmButton>
                    ) : null}
                  </div>
                </div>
                {payment.refundable_minor > 0 && can.money(roles) ? <RefundForm attemptId={payment.id} refundable={payment.refundable_minor} onDone={report} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No payments recorded yet{data.status === "PAID" ? " (older payments load from Razorpay when available)" : ""}.</Empty>
        )}
        {data.status === "PAYMENT_PENDING" && can.review(roles) ? (
          <ConfirmButton confirmLabel="Cancel registration" disabled={cancel.isPending}
            onConfirm={() => report(cancel.mutateAsync(undefined), "Registration cancelled; its team name and emails are free again.")}>
            Cancel unpaid registration
          </ConfirmButton>
        ) : null}
        {data.status === "PAID" && can.money(roles) ? <RejectForm data={data} /> : null}
        {(data.status === "ABANDONED" || data.status === "REJECTED") && can.review(roles) ? (
          <ConfirmButton confirmLabel="Delete for good" disabled={remove.isPending}
            onConfirm={() => report(remove.mutateAsync(undefined).then(onDeleted), data.status === "REJECTED" ? "Rejected registration deleted." : "Abandoned registration deleted.")}>
            Delete registration
          </ConfirmButton>
        ) : null}
      </section>

      <section className="space-y-2">
        <h3 className="font-medium tracking-tight">Refunds</h3>
        {data.refunds.length ? (
          <ul className="space-y-1 text-sm">
            {data.refunds.map((refund) => (
              <li key={refund.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <span>{rupees(refund.amount_minor)} · {refund.reason}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground"><StatusBadge status={refund.status} />{dateTime(refund.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : <Empty>No refunds.</Empty>}
      </section>

      <section className="space-y-2">
        <h3 className="font-medium tracking-tight">Orders</h3>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {data.orders.map((order) => (
            <li key={order.id} className="flex flex-wrap justify-between gap-2">
              <span>{order.provider_order_id} · {order.purpose.toLowerCase()} · {rupees(order.amount_minor)}</span>
              <StatusBadge status={order.status} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

type Member = RegistrationDetail["members"][number]

/** Add a member, or edit one (`member` given). The leader's email is their sign-in, so it stays fixed. */
function MemberForm({ registrationId, member, onDone }: { registrationId: string; member?: Member; onDone: () => void }) {
  const [form, setForm] = useState({
    full_name: member?.name ?? "", email: member?.email ?? "", phone: member?.phone ?? "", college: member?.college ?? "",
    is_acm_member: member?.is_acm_member ?? false, acm_id: member?.acm_id ?? "",
  })
  const save = useAdminMutation<typeof form>((body) => member
    ? { path: `/api/admin/teams/${registrationId}/members/${member.id}`, method: "PATCH", body: editBody(member, body) }
    : { path: `/api/admin/teams/${registrationId}/members`, body: { ...body, acm_id: body.is_acm_member ? body.acm_id : "" } },
  REGISTRATION_AREAS)
  const valid = form.full_name.trim() && /^\S+@\S+\.\S+$/.test(form.email.trim()) && /^[0-9+()\-\s]{7,20}$/.test(form.phone.trim())
    && form.college.trim() && (!form.is_acm_member || form.acm_id.trim())
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: key === "is_acm_member" ? event.target.checked : event.target.value })

  return (
    <form className="mt-3 grid gap-2 rounded-lg bg-muted/50 p-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) void notify(save.mutateAsync(form), member ? "Member updated." : `${form.full_name.trim()} was added to the team.`, onDone)
      }}>
      <Field label="Full name"><TextInput value={form.full_name} maxLength={120} onChange={set("full_name")} /></Field>
      <Field label="Email" hint={member?.role === "leader" ? "The leader's email is their sign-in." : undefined}>
        <TextInput type="email" value={form.email} maxLength={320} disabled={member?.role === "leader"} onChange={set("email")} />
      </Field>
      <Field label="Phone"><TextInput type="tel" value={form.phone} maxLength={20} onChange={set("phone")} /></Field>
      <Field label="College"><TextInput value={form.college} maxLength={200} onChange={set("college")} /></Field>
      {!member ? (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_acm_member} onChange={set("is_acm_member")} /> ACM member</label>
      ) : null}
      {form.is_acm_member ? <Field label="ACM ID" hint={member ? "A new ID needs ACM review again." : undefined}><TextInput value={form.acm_id} maxLength={80} onChange={set("acm_id")} /></Field> : null}
      <span className="flex gap-1 sm:col-span-2">
        <Button tone="green" type="submit" disabled={!valid || save.isPending}>{save.isPending ? "Saving…" : member ? "Save member" : "Add member"}</Button>
        <Button type="button" onClick={onDone}>Cancel</Button>
      </span>
    </form>
  )
}

function editBody(member: Member, form: { full_name: string; email: string; phone: string; college: string; acm_id: string }) {
  const body: Record<string, string> = {}
  if (form.full_name.trim() !== member.name) body.full_name = form.full_name.trim()
  if (member.role !== "leader" && form.email.trim().toLowerCase() !== member.email) body.email = form.email.trim()
  if (form.phone.trim() !== member.phone) body.phone = form.phone.trim()
  if (form.college.trim() !== member.college) body.college = form.college.trim()
  if (member.is_acm_member && form.acm_id.trim() && form.acm_id.trim().toUpperCase() !== member.acm_id) body.acm_id = form.acm_id.trim()
  return body
}

function Amount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-base font-semibold">{rupees(value)}</dd>
    </div>
  )
}

/** Super admins reject a registered team: whatever it paid is refunded in full and the leader is emailed the reason. */
function RejectForm({ data }: { data: RegistrationDetail }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const reject = useAdminMutation<string>((text) => ({ path: `/api/admin/registrations/${data.registration_id}/reject`, body: { reason: text } }), REGISTRATION_AREAS)
  const refundable = data.payments.filter((payment) => payment.status === "CAPTURED").reduce((sum, payment) => sum + payment.refundable_minor, 0)
  if (!open) return <div className="mt-2"><Button tone="red" onClick={() => setOpen(true)}>Reject registration…</Button></div>
  return (
    <div className="mt-3 grid gap-2 rounded-lg bg-red-500/5 p-3 ring-1 ring-red-500/20 sm:grid-cols-[1fr_auto] sm:items-end">
      <Field label="Reason (emailed to the leader)">
        <TextInput value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Duplicate of another team" />
      </Field>
      <span className="flex gap-1">
        <ConfirmButton confirmLabel={refundable ? `Reject and refund ${rupees(refundable)}` : "Reject registration"} disabled={reason.trim().length < 3 || reject.isPending}
          onConfirm={() => void notify(reject.mutateAsync(reason.trim()), refundable
            ? `Registration rejected; ${rupees(refundable)} is being refunded and the leader was emailed.`
            : "Registration rejected; the leader was emailed the reason.", () => setOpen(false))}>
          Reject team
        </ConfirmButton>
        <Button onClick={() => setOpen(false)}>Close</Button>
      </span>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        {refundable
          ? `${rupees(refundable)} will be refunded to the payer (5–7 working days). `
          : "No money was taken. "}
        The team leaves every list, its name and emails are free to register again, and the leader is emailed the reason. A rejected team with no money on record can then be deleted.
      </p>
    </div>
  )
}

function RefundForm({ attemptId, refundable, onDone }: { attemptId: string; refundable: number; onDone: (promise: Promise<unknown>, success: string) => void }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(String(refundable / 100))
  const [reason, setReason] = useState("")
  // One key per form opening: a double click or retry can never refund twice.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const refund = useAdminMutation<{ amount_minor: number; reason: string; idempotency_key: string }>(
    (body) => ({ path: `/api/admin/payments/${attemptId}/refunds`, body }),
    REGISTRATION_AREAS
  )
  const amountMinor = Math.round(Number(amount) * 100)
  const valid = Number.isFinite(amountMinor) && amountMinor > 0 && amountMinor <= refundable && reason.trim().length >= 3

  if (!open) return <div className="mt-2"><Button onClick={() => { setIdempotencyKey(crypto.randomUUID()); setOpen(true) }}>Refund…</Button></div>
  return (
    <div className="mt-3 grid gap-2 rounded-lg bg-muted/50 p-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
      <Field label={`Amount (max ${rupees(refundable)})`}>
        <TextInput type="number" min={1} step="1" max={refundable / 100} value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      <Field label="Reason (shown in the audit log)">
        <TextInput value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Duplicate team, declined details…" />
      </Field>
      <span className="flex gap-1">
        <ConfirmButton confirmLabel={`Refund ${rupees(amountMinor || 0)}`} disabled={!valid || refund.isPending}
          onConfirm={() => onDone(
            refund.mutateAsync({ amount_minor: amountMinor, reason: reason.trim(), idempotency_key: idempotencyKey })
              .then(() => setOpen(false))
              // A failed attempt is recorded under its key; a deliberate retry needs a fresh one.
              .catch((error) => { setIdempotencyKey(crypto.randomUUID()); throw error }),
            "Refund initiated. The leader was emailed (5–7 working days)."
          )}>
          Refund
        </ConfirmButton>
        <Button onClick={() => setOpen(false)}>Close</Button>
      </span>
      <p className="text-xs text-muted-foreground sm:col-span-3">
        Refunding the whole entry payment cancels the registration: the team leaves every list (find it under the Refunded filter) and the leader&apos;s dashboard asks them to register again. Either way the leader is emailed that the money arrives in 5–7 working days.
      </p>
    </div>
  )
}
