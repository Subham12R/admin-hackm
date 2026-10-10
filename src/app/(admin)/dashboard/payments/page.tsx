"use client"

import { useState } from "react"

import { Empty, Notice, PageHeader, Panel, StatusBadge } from "@/components/admin/kit"
import { Bones } from "@/components/admin/bones"
import { RegistrationDrawer } from "@/components/admin/registration-drawer"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { dateTime, errorMessage, rupees } from "@/lib/api"
import { keys, useAdminQuery } from "@/lib/queries"

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
  unknown_order: "No matching order (check Razorpay)",
}

export default function PaymentsPage() {
  const review = useAdminQuery<{ items: ReviewItem[] }>(keys.paymentsReview, "/api/admin/payments/review", { refetchInterval: 30_000 })
  const [open, setOpen] = useState<string | null>(null)
  const items = review.data?.items ?? []

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader title="Payments" description="Captured money that could not be matched to a registration automatically. Nothing here is lost; each needs a decision." />
      <Panel title="Needs review" description={`${items.length} payment${items.length === 1 ? "" : "s"} awaiting a decision`}>
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
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{dateTime(item.created_at)}</TableCell>
                  <TableCell className="font-medium">{item.team_name ?? "Unknown"}<p className="text-xs text-muted-foreground">{item.leader_email}</p></TableCell>
                  <TableCell className="tabular-nums">{rupees(item.amount_minor)}{item.refundable_minor < item.amount_minor ? <p className="text-xs text-muted-foreground">{rupees(item.amount_minor - item.refundable_minor)} refunded</p> : null}</TableCell>
                  <TableCell>{REASONS[item.review_reason ?? ""] ?? item.review_reason}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.provider_payment_id}<br />{item.method ?? ""} <StatusBadge status={item.status} /></TableCell>
                  <TableCell className="text-right">
                    {item.registration_id ? (
                      <button type="button" className="text-sm underline underline-offset-2" onClick={() => setOpen(item.registration_id)}>Resolve</button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <Empty>No payments need review.</Empty>}
        </Bones>
      </Panel>
      <RegistrationDrawer registrationId={open} onClose={() => setOpen(null)} />
    </div>
  )
}
