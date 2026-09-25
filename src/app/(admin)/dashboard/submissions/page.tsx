"use client"

import { useState } from "react"

import { ExternalLink } from "lucide-react"

import { RichButton } from "@/components/rich-button"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type SubmissionStatus = "Draft" | "Submitted" | "Evaluated"

type Submission = {
  teamId: string
  teamName: string
  projectName: string
  links: readonly { label: string; href: string }[]
  startTime: string
  endTime: string
  status: SubmissionStatus
}

const submissions = [
  {
    teamId: "HM-2026-001",
    teamName: "Binary Beacons",
    projectName: "Campus Compass",
    links: [
      { label: "GitHub", href: "https://github.com/hackmatrix/binary-beacons" },
      { label: "Demo", href: "https://binary-beacons.example.com" },
      { label: "Video", href: "https://youtube.com/watch?v=binary-beacons" },
    ],
    startTime: "07 Nov 2026, 09:00 AM",
    endTime: "07 Nov 2026, 03:42 PM",
    status: "Evaluated",
  },
  {
    teamId: "HM-2026-002",
    teamName: "Stack Sprinters",
    projectName: "Civic Connect",
    links: [
      { label: "GitHub", href: "https://github.com/hackmatrix/stack-sprinters" },
      { label: "Demo", href: "https://stack-sprinters.example.com" },
    ],
    startTime: "07 Nov 2026, 09:05 AM",
    endTime: "07 Nov 2026, 04:18 PM",
    status: "Submitted",
  },
  {
    teamId: "HM-2026-003",
    teamName: "Pixel Pioneers",
    projectName: "Care Queue",
    links: [
      { label: "GitHub", href: "https://github.com/hackmatrix/pixel-pioneers" },
      { label: "Demo", href: "https://pixel-pioneers.example.com" },
      { label: "Video", href: "https://youtube.com/watch?v=pixel-pioneers" },
    ],
    startTime: "07 Nov 2026, 09:12 AM",
    endTime: "07 Nov 2026, 02:56 PM",
    status: "Evaluated",
  },
  {
    teamId: "HM-2026-004",
    teamName: "Logic Loom",
    projectName: "Study Circle",
    links: [{ label: "GitHub", href: "https://github.com/hackmatrix/logic-loom" }],
    startTime: "07 Nov 2026, 09:20 AM",
    endTime: "—",
    status: "Draft",
  },
  {
    teamId: "HM-2026-005",
    teamName: "Code Catalysts",
    projectName: "Food Flow",
    links: [
      { label: "GitHub", href: "https://github.com/hackmatrix/code-catalysts" },
      { label: "Demo", href: "https://code-catalysts.example.com" },
    ],
    startTime: "07 Nov 2026, 09:25 AM",
    endTime: "07 Nov 2026, 04:05 PM",
    status: "Submitted",
  },
] satisfies readonly Submission[]

const statusClassName: Record<SubmissionStatus, string> = {
  Draft: "bg-zinc-100 text-zinc-700",
  Submitted: "bg-amber-50 text-amber-700",
  Evaluated: "bg-emerald-50 text-emerald-700",
}

const evaluators = ["Judge Ananya", "Judge Rohan", "Judge Meera"] as const

export default function SubmissionsPage() {
  const [assigneeByTeamId, setAssigneeByTeamId] = useState<Record<string, string>>({})

  function assignEvaluator(teamId: string, evaluator: string) {
    setAssigneeByTeamId((current) => ({ ...current, [teamId]: evaluator }))
  }

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Submissions</h1>
        <p className="text-sm tracking-tighter text-muted-foreground">
          Review project submissions from participant dashboards.
        </p>
      </div>

      <section className="min-w-0 rounded-2xl bg-zinc-100 p-1">
        <div className="min-w-0 overflow-hidden rounded-xl bg-white p-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight">Project submissions</h2>
            <p className="text-sm tracking-tighter text-muted-foreground">
              {submissions.length} submission{submissions.length === 1 ? "" : "s"}
            </p>
          </div>

          <Table className="min-w-[1120px]">
            <TableCaption className="sr-only">
              Project submissions with links, project timing, and review status.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="h-10 normal-case tracking-tighter">Team</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Project name</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Submission links</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Start time</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">End time</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Status</TableHead>
                <TableHead className="h-10 text-right normal-case tracking-tighter">Assign</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => (
                <TableRow key={submission.teamId}>
                  <TableCell>{submission.teamName}</TableCell>
                  <TableCell>{submission.projectName}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {submission.links.map((link) => (
                        <a
                          key={link.label}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs tracking-tighter text-zinc-700 hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                        >
                          {link.label}
                          <ExternalLink className="size-3" />
                        </a>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{submission.startTime}</TableCell>
                  <TableCell>{submission.endTime}</TableCell>
                  <TableCell>
                    <span
                      className={`rounded-md px-2 py-1 text-xs tracking-tighter ${statusClassName[submission.status]}`}
                    >
                      {submission.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <RichButton
                            type="button"
                            color="zinc"
                            size="sm"
                            className="font-pixel-square tracking-tighter"
                          >
                            {assigneeByTeamId[submission.teamId] ?? "Assign"}
                          </RichButton>
                        }
                      />
                      <DropdownMenuContent
                        align="end"
                        className="w-48 rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-900 shadow-xl"
                      >
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="font-pixel-square normal-case tracking-tighter">
                            Assign evaluator
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {evaluators.map((evaluator) => (
                            <DropdownMenuItem
                              key={evaluator}
                              onClick={() => assignEvaluator(submission.teamId, evaluator)}
                              className="font-pixel-square normal-case tracking-tighter"
                            >
                              {evaluator}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
