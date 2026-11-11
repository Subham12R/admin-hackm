"use client"

import { useState } from "react"

import { Badge, ConfirmButton, Field, Notice, Panel, TextInput } from "@/components/admin/kit"
import { dateTime, errorMessage } from "@/lib/api"
import { notify } from "@/lib/notify"
import { useAdminMutation, useAdminQuery } from "@/lib/queries"

type Overview = {
  decided: { PENDING: number; ACCEPTED: number; DECLINED: number }
  unreleased: { ACCEPTED: number; DECLINED: number }
  rsvp: { PENDING: number; CONFIRMED: number; DECLINED: number }
  rsvp_closes_at: string | null
}

const AREAS = [["finals"], ["teams"], ["registrations"]]

/** datetime-local value (browser time) for a stored instant. */
function localInput(iso: string | null) {
  if (!iso) return ""
  const date = new Date(iso)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/**
 * MLH-style decisions: accept or reject teams quietly in the table below, then email everyone whose
 * decision changed in one batch. Accepted teams confirm attendance (RSVP) before the deadline.
 */
export function FinalsDecisions({ canRelease }: { canRelease: boolean }) {
  const overview = useAdminQuery<Overview>(["finals"], "/api/admin/finals", { refetchInterval: 30_000 })
  const release = useAdminMutation<{ rsvp_closes_at?: string; send_emails?: boolean }, { released: { ACCEPTED: number; DECLINED: number }; emails: number }>(
    (body) => ({ path: "/api/admin/finals/release", body }),
    AREAS
  )
  const [deadline, setDeadline] = useState<string | null>(null)
  const data = overview.data
  const deadlineValue = deadline ?? localInput(data?.rsvp_closes_at ?? null)
  const pending = data ? data.unreleased.ACCEPTED + data.unreleased.DECLINED : 0
  const needsDeadline = Boolean(data?.unreleased.ACCEPTED) && !deadlineValue
  const deadlineChanged = Boolean(deadline) && deadlineValue !== localInput(data?.rsvp_closes_at ?? null)

  return (
    <Panel title="Finals decisions"
      description="Accept or reject teams in the table below; teams see nothing until you release. Send emails, or release without email if you tell teams another way. Accepted leaders RSVP from the email or their dashboard.">
      {overview.isError ? <Notice tone="red">{errorMessage(overview.error, "Finals overview could not be loaded.")}</Notice> : null}
      {data ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="green">{data.decided.ACCEPTED} accepted</Badge>
            <Badge tone="red">{data.decided.DECLINED} not selected</Badge>
            <Badge>{data.decided.PENDING} undecided</Badge>
            <span className="mx-1 text-muted-foreground">·</span>
            <Badge tone="green">{data.rsvp.CONFIRMED} attending</Badge>
            <Badge tone="red">{data.rsvp.DECLINED} can&apos;t attend</Badge>
            <Badge tone="amber">{data.rsvp.PENDING} RSVP pending</Badge>
          </div>
          {canRelease ? (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="RSVP deadline (your local time)" hint={data.rsvp_closes_at ? `Currently ${dateTime(data.rsvp_closes_at)}` : "Required before acceptances go out."}>
                <TextInput type="datetime-local" value={deadlineValue} onChange={(event) => setDeadline(event.target.value)} className="w-56" />
              </Field>
              <ConfirmButton tone="green"
                confirmLabel={`Email ${data.unreleased.ACCEPTED} acceptance${data.unreleased.ACCEPTED === 1 ? "" : "s"} and ${data.unreleased.DECLINED} rejection${data.unreleased.DECLINED === 1 ? "" : "s"}`}
                disabled={!pending || needsDeadline || release.isPending}
                onConfirm={() => void notify(
                  release.mutateAsync(deadlineValue && (deadlineChanged || !data.rsvp_closes_at) ? { rsvp_closes_at: new Date(deadlineValue).toISOString() } : {}),
                  "Decisions released; emails are on their way.",
                  () => setDeadline(null)
                )}>
                {pending ? `Send decision emails (${pending})` : "All decisions sent"}
              </ConfirmButton>
              {/* For decisions told another way (a broadcast, WhatsApp): teams' dashboards update, nobody is emailed. */}
              <ConfirmButton tone="zinc"
                confirmLabel={`Release ${data.unreleased.ACCEPTED} acceptance${data.unreleased.ACCEPTED === 1 ? "" : "s"} and ${data.unreleased.DECLINED} rejection${data.unreleased.DECLINED === 1 ? "" : "s"} without email`}
                disabled={!pending || release.isPending}
                onConfirm={() => void notify(
                  release.mutateAsync({
                    send_emails: false,
                    ...(deadlineValue && (deadlineChanged || !data.rsvp_closes_at) ? { rsvp_closes_at: new Date(deadlineValue).toISOString() } : {}),
                  }),
                  "Decisions released without email; accepted teams now see the finals on their dashboard.",
                  () => setDeadline(null)
                )}>
                {pending ? `Release without email (${pending})` : "Nothing to release"}
              </ConfirmButton>
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  )
}
