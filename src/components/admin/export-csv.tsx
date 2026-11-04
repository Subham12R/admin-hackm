"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Download } from "lucide-react"

import { Button, Notice, Select } from "@/components/admin/kit"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { api, errorMessage } from "@/lib/api"
import { toast } from "@/lib/notify"
import { useHydrated } from "@/hooks/use-hydrated"
import { can, keys, useRoles } from "@/lib/queries"

export type ExportField = { key: string; label: string; default: boolean }
export type ExportDataset = { key: string; label: string; one_row_per: string; fields: ExportField[] }
export type ExportJob = {
  id: string
  dataset: string
  dataset_label: string
  fields: string[]
  scope: "SELECTED" | "FILTERED" | "ALL"
  filters: Record<string, string>
  selected: number
  status: "QUEUED" | "RUNNING" | "READY" | "EXPIRED" | "FAILED"
  row_count: number
  file_name: string
  size_bytes: number | null
  error: string | null
  requested_by: string | null
  created_at: string | null
  finished_at: string | null
  expires_at: string | null
  download_count: number
}

type Scope = ExportJob["scope"]
/** Filter keys the backend understands; anything else on the table (like a date) is not applied. */
type ExportFilters = Partial<Record<"search" | "status" | "category" | "finals" | "review" | "stage_id" | "track_id" | "round_id", string>>

const FIELDS_KEY = (dataset: string) => `hm:export-fields:${dataset}`

function rememberedFields(dataset: ExportDataset): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(FIELDS_KEY(dataset.key)) ?? "null")
    if (Array.isArray(stored)) {
      const known = new Set(dataset.fields.map((field) => field.key))
      const kept = stored.filter((key): key is string => typeof key === "string" && known.has(key))
      if (kept.length) return kept
    }
  } catch {
    // Private windows and blocked storage fall back to the defaults.
  }
  return dataset.fields.filter((field) => field.default).map((field) => field.key)
}

function remember(dataset: string, fields: string[]) {
  try {
    window.localStorage.setItem(FIELDS_KEY(dataset), JSON.stringify(fields))
  } catch {
    // Not remembering is fine.
  }
}

export function fileSize(bytes: number | null) {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function useExportDatasets(enabled = true) {
  return useQuery({
    queryKey: keys.exportDatasets,
    queryFn: () => api<{ datasets: ExportDataset[] }>("/api/admin/exports/datasets"),
    staleTime: 10 * 60_000,
    enabled,
  })
}

/**
 * "Export CSV" on a table: pick the dataset, the columns, and whether to export the ticked rows,
 * everything the table's filters match, or the whole dataset. The file is built in the background
 * and appears on the Exports page; this panel also offers the download once it is ready.
 */
export function ExportCsv({ datasets, filters = {}, selectedIds = [], ignored }: {
  datasets: string[]
  filters?: ExportFilters
  selectedIds?: string[]
  /** Table filters the export cannot apply, shown as a note (for example a date). */
  ignored?: string
}) {
  const roles = useRoles()
  const [open, setOpen] = useState(false)
  const hydrated = useHydrated()
  if (!hydrated || !can.eventControl(roles)) return null
  return (
    <>
      <Button onClick={() => setOpen(true)} title="Download this table as a CSV file">
        <Download className="mr-1 inline size-3.5" aria-hidden="true" />Export CSV
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto font-pixel-square sm:max-w-md data-[side=right]:sm:max-w-md">
          {open ? <ExportPanel datasets={datasets} filters={filters} selectedIds={selectedIds} ignored={ignored} /> : null}
        </SheetContent>
      </Sheet>
    </>
  )
}

function ExportPanel({ datasets, filters, selectedIds, ignored }: {
  datasets: string[]
  filters: ExportFilters
  selectedIds: string[]
  ignored?: string
}) {
  const client = useQueryClient()
  const catalog = useExportDatasets()
  const options = (catalog.data?.datasets ?? []).filter((item) => datasets.includes(item.key))
  const [datasetKey, setDatasetKey] = useState(datasets[0])
  const dataset = options.find((item) => item.key === datasetKey) ?? options[0]
  const [fields, setFields] = useState<string[] | null>(null)
  const [scope, setScope] = useState<Scope>(selectedIds.length ? "SELECTED" : "FILTERED")
  const [busy, setBusy] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)

  // Load the columns this person used last time for this dataset.
  useEffect(() => {
    if (!dataset) return
    const timer = setTimeout(() => setFields(rememberedFields(dataset)), 0)
    return () => clearTimeout(timer)
  }, [dataset])

  const job = useQuery({
    queryKey: keys.exportJob(jobId ?? ""),
    queryFn: () => api<ExportJob>(`/api/admin/exports/${jobId}`),
    enabled: Boolean(jobId),
    refetchInterval: (query) => (query.state.data && !["QUEUED", "RUNNING"].includes(query.state.data.status) ? false : 1500),
  })

  const activeFilters = Object.entries(filters).filter(([, value]) => value)
  const chosen = fields ?? []

  function toggle(key: string, checked: boolean) {
    if (!dataset) return
    const next = checked ? dataset.fields.map((field) => field.key).filter((item) => item === key || chosen.includes(item)) : chosen.filter((item) => item !== key)
    setFields(next)
  }

  async function start() {
    if (!dataset || !chosen.length) return
    setBusy(true)
    try {
      remember(dataset.key, chosen)
      const created = await api<ExportJob>("/api/admin/exports", {
        method: "POST",
        body: { dataset: dataset.key, fields: chosen, scope, filters: Object.fromEntries(activeFilters), ids: scope === "SELECTED" ? selectedIds : [] },
      })
      setJobId(created.id)
      void client.invalidateQueries({ queryKey: keys.exports })
    } catch (error) {
      toast.error(errorMessage(error, "The export could not be started."))
    } finally {
      setBusy(false)
    }
  }

  const status = job.data?.status
  return (
    <div className="space-y-5 p-4 text-sm">
      <SheetHeader className="px-0">
        <SheetTitle className="text-xl tracking-tight">Export CSV</SheetTitle>
        <SheetDescription className="tracking-tighter">
          The file is built in the background, 500 rows at a time, and kept for 24 hours on the <Link className="underline" href="/dashboard/exports">Exports</Link> page.
        </SheetDescription>
      </SheetHeader>

      {catalog.isError ? <Notice tone="red">The export options could not be loaded.</Notice> : null}
      {!dataset ? <p className="text-muted-foreground">Loading…</p> : (
        <>
          {options.length > 1 ? (
            <label className="block space-y-1">
              <span className="font-medium">One row per</span>
              <Select value={dataset.key} onChange={(event) => { setDatasetKey(event.target.value); setFields(null) }}>
                {options.map((item) => <option key={item.key} value={item.key}>{item.one_row_per} ({item.label})</option>)}
              </Select>
            </label>
          ) : null}

          <fieldset className="space-y-1.5">
            <legend className="mb-1 font-medium">Rows</legend>
            <ScopeOption value="SELECTED" current={scope} onChange={setScope} disabled={!selectedIds.length}
              label={selectedIds.length ? `The ${selectedIds.length} ticked ${selectedIds.length === 1 ? "row" : "rows"}` : "Ticked rows (tick some in the table first)"} />
            <ScopeOption value="FILTERED" current={scope} onChange={setScope}
              label={activeFilters.length ? "Everything matching the table's search and filters" : "Everything the table shows (no filters set)"} />
            <ScopeOption value="ALL" current={scope} onChange={setScope} label={`All ${dataset.label.toLowerCase()} in this edition`} />
            {scope === "FILTERED" && activeFilters.length ? (
              <p className="pl-6 text-xs text-muted-foreground">{activeFilters.map(([key, value]) => `${key.replace("_id", "")}: ${value}`).join(" · ")}</p>
            ) : null}
            {ignored && scope === "FILTERED" ? <p className="pl-6 text-xs text-amber-700 dark:text-amber-400">{ignored}</p> : null}
          </fieldset>

          <fieldset className="space-y-1">
            <div className="mb-1 flex items-center justify-between">
              <legend className="font-medium">Columns ({chosen.length})</legend>
              <span className="flex gap-2 text-xs">
                <button type="button" className="underline" onClick={() => setFields(dataset.fields.map((field) => field.key))}>All</button>
                <button type="button" className="underline" onClick={() => setFields(dataset.fields.filter((field) => field.default).map((field) => field.key))}>Defaults</button>
              </span>
            </div>
            <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
              {dataset.fields.map((field) => (
                <label key={field.key} className="flex items-center gap-2">
                  <input type="checkbox" checked={chosen.includes(field.key)} onChange={(event) => toggle(field.key, event.target.checked)} />
                  {field.label}
                </label>
              ))}
            </div>
          </fieldset>

          {!jobId || status === "FAILED" ? (
            <Button tone="green" disabled={busy || !chosen.length} onClick={() => void start()}>
              {busy ? "Starting…" : status === "FAILED" ? "Try again" : "Start export"}
            </Button>
          ) : null}
          {jobId ? <JobLine job={job.data} /> : null}
        </>
      )}
    </div>
  )
}

function ScopeOption({ value, current, onChange, label, disabled }: {
  value: Scope
  current: Scope
  onChange: (scope: Scope) => void
  label: string
  disabled?: boolean
}) {
  return (
    <label className={`flex items-center gap-2 ${disabled ? "opacity-50" : ""}`}>
      <input type="radio" name="export-scope" checked={current === value} disabled={disabled} onChange={() => onChange(value)} />
      {label}
    </label>
  )
}

function JobLine({ job }: { job: ExportJob | undefined }) {
  if (!job || job.status === "QUEUED") return <Notice>Queued…</Notice>
  if (job.status === "RUNNING") return <Notice tone="amber">Building… {job.row_count} rows so far</Notice>
  if (job.status === "FAILED") return <Notice tone="red">{job.error ?? "The export failed."}</Notice>
  if (job.status === "EXPIRED") return <Notice>This file has expired.</Notice>
  return (
    <div className="space-y-2">
      <Notice tone="green">{job.row_count} rows · {fileSize(job.size_bytes)}</Notice>
      <a href={`/api/admin/exports/${job.id}/download`} download={job.file_name}
        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
        <Download className="size-3.5" aria-hidden="true" />Download {job.file_name}
      </a>
    </div>
  )
}
