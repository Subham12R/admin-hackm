import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type AuditLog = {
  timestamp: string
  actor: string
  action: string
  resource: string
  details: string
}

const auditLogs = [
  {
    timestamp: "07 Nov 2026, 10:42 AM",
    actor: "Admin",
    action: "Assigned evaluator",
    resource: "Submission HM-K8Q2P",
    details: "Judge Ananya assigned",
  },
  {
    timestamp: "07 Nov 2026, 10:29 AM",
    actor: "Admin",
    action: "Updated challenge brief",
    resource: "Challenge",
    details: "Published version 1.3",
  },
  {
    timestamp: "07 Nov 2026, 10:05 AM",
    actor: "Admin",
    action: "Published announcement",
    resource: "Event updates",
    details: "Registration reminder",
  },
  {
    timestamp: "07 Nov 2026, 09:54 AM",
    actor: "Aarav Sen",
    action: "Submitted registration",
    resource: "Binary Beacons",
    details: "Adamas University",
  },
  {
    timestamp: "07 Nov 2026, 09:32 AM",
    actor: "Admin",
    action: "Updated event controls",
    resource: "Registrations",
    details: "Enabled registrations",
  },
  {
    timestamp: "07 Nov 2026, 09:18 AM",
    actor: "Judge Rohan",
    action: "Submitted evaluation",
    resource: "Submission HM-M4X7D",
    details: "Round 1 scores recorded",
  },
  {
    timestamp: "07 Nov 2026, 09:04 AM",
    actor: "Admin",
    action: "Recalculated scores",
    resource: "Leaderboard",
    details: "Results remain private",
  },
  {
    timestamp: "07 Nov 2026, 08:47 AM",
    actor: "Admin",
    action: "Updated submission status",
    resource: "Submission HM-T9V3L",
    details: "Marked as evaluated",
  },
] satisfies readonly AuditLog[]

export default function LogsPage() {
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
              {auditLogs.map((log) => (
                <TableRow
                  key={`${log.timestamp}-${log.action}`}
                  className={log.actor === "Admin" ? "bg-red-50 hover:bg-red-100" : undefined}
                >
                  <TableCell>{log.timestamp}</TableCell>
                  <TableCell className="font-medium">{log.actor}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.resource}</TableCell>
                  <TableCell>{log.details}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
