"use client"

import { useEffect, useState } from "react"

import { useRouter } from "next/navigation"

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AdminDataError,
  getAdminJson,
  logsSchema,
  toAuditLogs,
  type AuditLog,
} from "@/lib/admin-client"

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp))
}

export default function LogsPage() {
  const router = useRouter()
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    getAdminJson("/api/admin/logs", logsSchema, controller.signal)
      .then((response) => {
        setLoadError("")
        setAuditLogs(toAuditLogs(response))
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof AdminDataError && error.status === 401) {
          router.replace("/login")
          return
        }
        setLoadError("Audit logs could not be loaded.")
      })
    return () => controller.abort()
  }, [router])

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
        <p className="text-sm tracking-tighter text-muted-foreground">
          Read-only history of dashboard activity.
        </p>
      </div>

      <section className="min-w-0 rounded-2xl bg-zinc-100 p-1">
        <div className="min-w-0 overflow-hidden rounded-xl bg-white p-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight">Recent activity</h2>
            {loadError ? <p role="alert" className="text-sm text-red-600">{loadError}</p> : null}
            <p className="text-sm tracking-tighter text-muted-foreground">
              {auditLogs.length} recorded events
            </p>
          </div>

          <Table className="min-w-[920px]">
            <TableCaption className="sr-only">
              Audit events with timestamp, actor, action, resource, and details.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="h-10 normal-case tracking-tighter">Timestamp</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Actor</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Action</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Resource</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.length ? auditLogs.map((log) => (
                <TableRow key={`${log.timestamp}-${log.action}`}>
                  <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
                  <TableCell className="font-medium">{log.actor}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.resource}</TableCell>
                  <TableCell>{log.details}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {loadError || "Loading activity..."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
