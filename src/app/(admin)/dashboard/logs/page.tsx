"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { useState } from "react"

import { Button, Empty, Field, Notice, PageHeader, Panel, TextInput } from "@/components/admin/kit"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getAdminJson, logsSchema, toAuditLogs } from "@/lib/admin-client"
import { dateTime, errorMessage } from "@/lib/api"
import { z } from "zod"

const pageSchema = logsSchema.extend({ next_before: z.string().nullable().optional() })

export default function LogsPage() {
  const [action, setAction] = useState("")
  const [applied, setApplied] = useState("")
  const logs = useInfiniteQuery({
    queryKey: ["logs", applied],
    initialPageParam: "",
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: "100" })
      if (pageParam) params.set("before", pageParam)
      if (applied) params.set("action", applied)
      return getAdminJson(`/api/admin/logs?${params}`, pageSchema, signal)
    },
    getNextPageParam: (page) => page.next_before ?? undefined,
    refetchInterval: 60_000,
  })
  const rows = logs.data?.pages.flatMap((page) => toAuditLogs(page)) ?? []

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader title="Audit Logs" description="Append-only record of sign-ins, reviews, payments, refunds, judging, and releases." />
      <Panel
        title="Activity"
        description={`${rows.length} entries loaded`}
        actions={
          <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); setApplied(action.trim()) }}>
            <Field label="Exact action">
              <TextInput value={action} onChange={(event) => setAction(event.target.value)} placeholder="e.g. Refund requested" />
            </Field>
            <Button type="submit">Filter</Button>
          </form>
        }
      >
        {logs.isError ? <Notice tone="red">{errorMessage(logs.error, "Logs could not be loaded.")}</Notice> : null}
        {!logs.isPending && !rows.length ? <Empty>No activity recorded{applied ? " for that action" : ""}.</Empty> : (
          <Table className="min-w-[900px]">
            <TableCaption className="sr-only">Audit log entries, newest first.</TableCaption>
            <TableHeader>
              <TableRow>
                {["Time", "Actor", "Action", "Target", "Details"].map((label) => <TableHead key={label} className="h-10 normal-case tracking-tighter">{label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.isPending ? (
                <TableRow><TableCell colSpan={5}><div className="h-5 w-full animate-pulse rounded bg-zinc-100" /></TableCell></TableRow>
              ) : rows.map((log) => (
                <TableRow key={log.id ?? `${log.timestamp}-${log.action}-${log.resource}`}>
                  <TableCell className="whitespace-nowrap text-xs">{dateTime(log.timestamp)}</TableCell>
                  <TableCell className="font-medium">{log.actor}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell className="text-xs">{log.resource}</TableCell>
                  <TableCell className="max-w-md whitespace-normal text-xs">{log.details}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {logs.hasNextPage ? (
          <div className="mt-4 flex justify-center">
            <Button disabled={logs.isFetchingNextPage} onClick={() => void logs.fetchNextPage()}>{logs.isFetchingNextPage ? "Loading…" : "Load older entries"}</Button>
          </div>
        ) : null}
      </Panel>
    </div>
  )
}
