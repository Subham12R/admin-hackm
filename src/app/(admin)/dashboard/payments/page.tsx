"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { Button, ConfirmButton, Empty, Notice, PageHeader, Panel, StatusBadge, TextInput } from "@/components/admin/kit"
import { Bones } from "@/components/admin/bones"
import { RegistrationDrawer } from "@/components/admin/registration-drawer"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { dateTime, errorMessage, rupees } from "@/lib/api"
import { adminQuery, overviewSchema, toOverview } from "@/lib/admin-client"
import { notify } from "@/lib/notify"
import { SearchBox } from "@/components/admin/search-box"
import { useTableSearch } from "@/hooks/use-table-search"
import { ExportCsv } from "@/components/admin/export-csv"
import { can, keys, useAdminMutation, useAdminQuery, useRoles } from "@/lib/queries"

type ReviewItem = {
  id: string
  provider_payment_id: string
  provider_order_id: string
  amount_minor: number
  status: string
  review_reason: string | null
  method: string | null
  created_at: string
  refundable_minor: number
  registration_id: string | null
  team_name: string | null
  leader_email: string | null
}

const REASONS: Record<string, string> = {
  amount_mismatch: "Amount did not match the order",
  duplicate_payment: "Second payment on a paid order (refund it)",
  cancelled_order: "Paid on a replaced order (accept or refund)",
  registration_not_pending: "Registration was not awaiting payment (accept or refund)",
  leader_already_paid: "Leader already has a paid team (refund it)",
  unknown_order: "No HackMatrix order: likely another product on this Razorpay account",
}
const RAZORPAY_PAYMENT = "https://dashboard.razorpay.com/app/payments/"

export default function PaymentsPage() {
  const money = can.money(useRoles())
  const review = useAdminQuery<{ items: ReviewItem[] }>(keys.paymentsReview, "/api/admin/payments/review", { refetchInterval: 30_000 })
  // Same numbers as the overview, so they never disagree.
  const overview = useQuery({ queryKey: keys.overview, queryFn: adminQuery("/api/admin/overview", overviewSchema), select: toOverview, refetchInterval: 60_000 })
  const [open, setOpen] = useState<string | null>(null)
  const search = useTableSearch()
  const needle = search.term.toLowerCase()
  const all = review.data?.items ?? []
  const items = needle
    ? all.filter((item) => [item.team_name, item.leader_email, item.provider_payment_id, item.provider_order_id].some((value) => value?.toLowerCase().includes(needle)))
    : all
  const metrics = overview.data?.metrics

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader title="Payments" description="Captured money that could not be matched to a registration automatically. Nothing here is lost; each needs a decision."
        actions={<ExportCsv datasets={["payments"]} filters={{ search: search.term || undefined }} />} />
      <Panel title="Registration payments" description="Teams with an active registration.">
        {metrics ? (
          <p className="text-sm tracking-tighter">
            <span className="font-medium">{metrics.paidTeams.toLocaleString()} paid</span> (including free entries) ·{" "}
            <span className="font-medium">{Math.max(0, metrics.registrations - metrics.paidTeams).toLocaleString()} awaiting payment</span>
          </p>
        ) : <p className="text-sm text-muted-foreground">{overview.isError ? "Counts could not be loaded." : "Loading…"}</p>}
      </Panel>
      <Panel title="Needs review" description={`${all.length} payment${all.length === 1 ? "" : "s"} awaiting a decision${needle ? `, ${items.length} matching` : ""}`}
        actions={<SearchBox label="" value={search.value} onChange={search.setValue} placeholder="Team, email or payment id" />}>
        {review.isError ? <Notice tone="red">{errorMessage(review.error, "Payments could not be loaded.")}</Notice> : null}
        <Bones name="payments-review" loading={review.isPending}>
        {items.length ? (
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                {["Received", "Team", "Amount", "Why", "Payment", ""].map((label) => <TableHead key={label} className="h-10 normal-case tracking-tighter">{label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => <ReviewRow key={item.id} item={item} money={money} onResolve={setOpen} />)}
            </TableBody>
          </Table>
        ) : <Empty>No payments need review.</Empty>}
        </Bones>
      </Panel>
      <RegistrationDrawer registrationId={open} onClose={() => setOpen(null)} />
    </div>
  )
}

function ReviewRow({ item, money, onResolve }: { item: ReviewItem; money: boolean; onResolve: (registrationId: string) => void }) {
  const [dismissing, setDismissing] = useState(false)
  return (
    <>
      <TableRow>
        <TableCell>{dateTime(item.created_at)}</TableCell>
        <TableCell className="font-medium">{item.team_name ?? "Unknown"}<p className="text-xs text-muted-foreground">{item.leader_email}</p></TableCell>
        <TableCell className="tabular-nums">{rupees(item.amount_minor)}{item.refundable_minor < item.amount_minor ? <p className="text-xs text-muted-foreground">{rupees(item.amount_minor - item.refundable_minor)} refunded</p> : null}</TableCell>
        <TableCell>{REASONS[item.review_reason ?? ""] ?? item.review_reason}</TableCell>
        <TableCell className="text-xs text-muted-foreground">
          <a href={`${RAZORPAY_PAYMENT}${item.provider_payment_id}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{item.provider_payment_id}</a>
          <br />{item.provider_order_id}<br />{item.method ?? ""} <StatusBadge status={item.status} />
        </TableCell>
        <TableCell className="text-right">
          {item.registration_id ? (
            <button type="button" className="text-sm underline underline-offset-2" onClick={() => onResolve(item.registration_id!)}>Resolve</button>
          ) : money && !dismissing ? <Button onClick={() => setDismissing(true)}>Dismiss…</Button> : null}
        </TableCell>
      </TableRow>
      {dismissing ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={6} className="whitespace-normal">
            <DismissPayment item={item} onClose={() => setDismissing(false)} />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

/** A captured payment with no HackMatrix order cannot be accepted or refunded here; clear it once checked in Razorpay. */
function DismissPayment({ item, onClose }: { item: ReviewItem; onClose: () => void }) {
  const [note, setNote] = useState("")
  const dismiss = useAdminMutation<string>((text) => ({ path: `/api/admin/payments/${item.id}/dismiss`, body: { note: text } }), [keys.paymentsReview])
  return (
    <div className="grid gap-2 rounded-lg bg-muted/50 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="grid gap-1">
        <p className="text-xs text-muted-foreground">
          Open the payment in Razorpay first. If it is not a HackMatrix payment (for example another product on the same Razorpay account), dismiss it here. Nothing moves; refund it from the Razorpay dashboard if it needs one.
        </p>
        <TextInput aria-label="Why it is not a HackMatrix payment" value={note} maxLength={300} placeholder="Why it is not ours, e.g. SecureMail order" onChange={(event) => setNote(event.target.value)} />
      </div>
      <span className="flex gap-1">
        <ConfirmButton confirmLabel="Dismiss payment" disabled={note.trim().length < 3 || dismiss.isPending}
          onConfirm={() => void notify(dismiss.mutateAsync(note.trim()), "Payment dismissed. The note is kept in the logs.")}>Dismiss</ConfirmButton>
        <Button onClick={onClose}>Cancel</Button>
      </span>
    </div>
  )
}
