"use client"

import { useQuery } from "@tanstack/react-query"

import { fileSize, type ExportJob } from "@/components/admin/export-csv"
import { Badge, Button, ConfirmButton, Empty, LoadingRows, Notice, PageHeader, Panel, type Tone } from "@/components/admin/kit"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, dateTime, errorMessage } from "@/lib/api"
import { notify } from "@/lib/notify"
import { can, keys, useAdminMutation, useRoles } from "@/lib/queries"

const STATUS: Record<ExportJob["status"], { tone: Tone; label: string }> = {
  QUEUED: { tone: "zinc", label: "Queued" },
  RUNNING: { tone: "amber", label: "Building" },
  READY: { tone: "green", label: "Ready" },
  EXPIRED: { tone: "zinc", label: "Expired" },
  FAILED: { tone: "red", label: "Failed" },
}

const SCOPE: Record<ExportJob["scope"], string> = { SELECTED: "Ticked rows", FILTERED: "Matching filters", ALL: "Everything" }

function scopeText(job: ExportJob) {
  if (job.scope === "SELECTED") return `${job.selected} ticked`
  const filters = Object.entries(job.filters).map(([key, value]) => `${key.replace("_id", "")}: ${value}`).join(" · ")
  return filters ? `${SCOPE[job.scope]} (${filters})` : SCOPE[job.scope]
}

export default function ExportsPage() {
  const roles = useRoles()
  const allowed = can.eventControl(roles)
  const exports = useQuery({
    queryKey: keys.exports,
    queryFn: () => api<{ items: ExportJob[] }>("/api/admin/exports"),
    enabled: allowed,
    // Poll quickly only while a file is being built.
    refetchInterval: (query) => (query.state.data?.items.some((job) => job.status === "QUEUED" || job.status === "RUNNING") ? 2000 : 30_000),
  })
  const retry = useAdminMutation<string>((id) => ({ path: `/api/admin/exports/${id}/retry` }), [keys.exports])
  const remove = useAdminMutation<string>((id) => ({ path: `/api/admin/exports/${id}`, method: "DELETE" }), [keys.exports])
  const items = exports.data?.items ?? []

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader title="Exports" description="CSV files made from the tables with Export CSV. Each file is kept for 24 hours, then it expires and can be built again." />
      {!allowed ? <Notice>Only Event Control staff can make or download exports.</Notice> : (
        <Panel title="Files" description={`${items.length} recent ${items.length === 1 ? "export" : "exports"}`}>
          {exports.isError ? <Notice tone="red">{errorMessage(exports.error, "Exports could not be loaded.")}</Notice> : null}
          {exports.isPending ? <LoadingRows rows={4} /> : !items.length ? (
            <Empty>No exports yet. Use Export CSV on Registrations, Teams, Submissions, Payments, Contacts, Check-in, Evaluations or Rounds.</Empty>
          ) : (
            <Table className="min-w-[960px]">
              <TableCaption className="sr-only">CSV exports, newest first.</TableCaption>
              <TableHeader>
                <TableRow>
                  {["File", "Rows", "Columns", "Status", "Made by", "Made at", "Expires", ""].map((label) => (
                    <TableHead key={label || "actions"} className="h-10 normal-case tracking-tighter">{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="max-w-xs whitespace-normal">
                      <div className="font-medium">{job.dataset_label}</div>
                      <div className="text-xs text-muted-foreground">{scopeText(job)}</div>
                    </TableCell>
                    <TableCell className="text-xs">{job.row_count}{job.status === "READY" ? ` · ${fileSize(job.size_bytes)}` : ""}</TableCell>
                    <TableCell className="text-xs">{job.fields.length}</TableCell>
                    <TableCell>
                      <Badge tone={STATUS[job.status].tone}>{STATUS[job.status].label}</Badge>
                      {job.error ? <div className="mt-1 max-w-56 whitespace-normal text-xs text-red-700 dark:text-red-300">{job.error}</div> : null}
                    </TableCell>
                    <TableCell className="text-xs">{job.requested_by ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{dateTime(job.created_at)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{job.status === "READY" ? dateTime(job.expires_at) : "—"}</TableCell>
                    <TableCell>
                      <span className="flex items-center justify-end gap-1 whitespace-nowrap">
                        {job.status === "READY" ? (
                          <a href={`/api/admin/exports/${job.id}/download`} download={job.file_name} title={job.file_name}
                            className="inline-flex h-7 items-center rounded-md bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700">
                            Download{job.download_count ? ` (${job.download_count})` : ""}
                          </a>
                        ) : null}
                        {job.status === "FAILED" || job.status === "EXPIRED" ? (
                          <Button disabled={retry.isPending} onClick={() => notify(retry.mutateAsync(job.id), "Export queued again.")}>Build again</Button>
                        ) : null}
                        {job.status !== "RUNNING" ? (
                          <ConfirmButton confirmLabel="Delete" disabled={remove.isPending} onConfirm={() => notify(remove.mutateAsync(job.id), "Export deleted.")}>Delete</ConfirmButton>
                        ) : null}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      )}
    </div>
  )
}
