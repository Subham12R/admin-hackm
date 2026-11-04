"use client"

import Link from "next/link"

import { Badge, Empty, LoadingRows, Notice, PageHeader, Panel, StatusBadge } from "@/components/admin/kit"
import { errorMessage } from "@/lib/api"
import { keys, useAdminQuery } from "@/lib/queries"
import { SearchBox } from "@/components/admin/search-box"
import { useTableSearch } from "@/hooks/use-table-search"

export type JudgeItem = {
  assignment_id: string
  code: string | null
  project_name: string
  round: { id: string; name: string; status: string }
  scorecard_status: string
  total: number | null
}

export default function JudgingPage() {
  const list = useAdminQuery<{ items: JudgeItem[] }>(keys.judgeAssignments, "/api/judge/assignments", { refetchInterval: 60_000 })
  const search = useTableSearch()
  const needle = search.term.toLowerCase()
  const all = list.data?.items ?? []
  const items = needle ? all.filter((item) => [item.code ?? "", item.project_name].some((value) => value.toLowerCase().includes(needle))) : all
  const rounds = [...new Map(items.map((item) => [item.round.id, item.round])).values()]
  const done = items.filter((item) => item.scorecard_status === "SUBMITTED").length

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader title="My Assignments" description="Projects are anonymous: you see a code and the project's links, never the team." />
      {list.isError ? <Notice tone="red">{errorMessage(list.error, "Assignments could not be loaded.")}</Notice> : null}
      {all.length ? <SearchBox value={search.value} onChange={search.setValue} placeholder="Submission code or project" /> : null}
      {list.isPending ? <LoadingRows rows={5} /> : !items.length ? <Panel><Empty>{all.length ? "No assignments match your search." : "No projects are assigned to you yet."}</Empty></Panel> : (
        <>
          <p className="text-sm text-muted-foreground">{done} of {items.length} scored</p>
          {rounds.map((round) => (
            <Panel key={round.id} title={round.name} description={round.status === "OPEN" ? "Open for scoring" : round.status === "DRAFT" ? "Not open yet; you can preview projects" : "Closed; scores are final"}
              actions={<StatusBadge status={round.status} />}>
              <ul className="admin-stagger divide-y divide-border">
                {items.filter((item) => item.round.id === round.id).map((item) => (
                  <li key={item.assignment_id}>
                    <Link href={`/dashboard/judging/${item.assignment_id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/50">
                      <span>
                        <span className="font-mono text-xs text-muted-foreground">{item.code}</span>
                        <span className="block font-medium">{item.project_name || "Untitled project"}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {item.total !== null ? <Badge>{item.total.toFixed(1)}%</Badge> : null}
                        <StatusBadge status={item.scorecard_status} label={item.scorecard_status === "NOT_STARTED" ? "to score" : undefined} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </>
      )}
    </div>
  )
}
