"use client"

import { type ReactNode, useState } from "react"

import { format } from "date-fns"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { CalendarIcon } from "lucide-react"

import { Area, AreaChart } from "@/components/charts/area-chart"
import { Grid } from "@/components/charts/grid"
import { ChartTooltip } from "@/components/charts/tooltip"
import { XAxis } from "@/components/charts/x-axis"
import { RichButton } from "@/components/rich-button"
import { toast } from "sonner"

import { Badge, ConfirmButton, RegistrationBadge } from "@/components/admin/kit"
import { Bones } from "@/components/admin/bones"
import { RegistrationDrawer } from "@/components/admin/registration-drawer"
import { TeamInvites } from "@/components/admin/team-invites"
import { rupees } from "@/lib/api"
import { can, keys, useAdminMutation, useMe } from "@/lib/queries"
import {
  adminQuery,
  registrationCategories,
  registrationsPageSchema,
  toRegistrationsPage,
  type Registration,
  type RegistrationCategory,
} from "@/lib/admin-client"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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

const PAGE_SIZE = 10


function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
    new Date(`${date}T00:00:00`)
  )
}

type RegistrationColumnKey =
  | "registeredAt"
  | "teamName"
  | "leader"
  | "email"
  | "phone"
  | "college"
  | "members"
  | "acm"
  | "category"
  | "paymentStatus"
  | "amount"

type RegistrationColumn = {
  key: RegistrationColumnKey
  label: string
  className?: string
  render: (registration: Registration) => ReactNode
}

const registrationColumns: readonly RegistrationColumn[] = [
  { key: "registeredAt", label: "Date", render: (registration: Registration) => formatDate(registration.registeredAt) },
  { key: "teamName", label: "Team name", className: "font-medium", render: (registration: Registration) => registration.teamName },
  { key: "leader", label: "Team leader", render: (registration: Registration) => registration.leader },
  { key: "email", label: "Email", render: (registration: Registration) => registration.email },
  { key: "phone", label: "Phone", render: (registration: Registration) => registration.phone },
  { key: "college", label: "College", render: (registration: Registration) => registration.college },
  { key: "members", label: "Members", className: "text-center tabular-nums", render: (registration: Registration) => registration.members },
  {
    key: "acm",
    label: "ACM",
    render: (registration: Registration) =>
      registration.acm === "Yes" ? (
        <span className="inline-flex items-center gap-1.5">
          Yes
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tracking-tighter text-muted-foreground">
            {registration.acmMembers} ACM
          </span>
        </span>
      ) : (
        "No"
      ),
  },
  { key: "category", label: "Category", render: (registration: Registration) => registration.category },
  {
    key: "paymentStatus",
    label: "Payment status",
    render: (registration: Registration) => (
      <span className="inline-flex flex-wrap items-center gap-1">
        <RegistrationBadge status={registration.registrationStatus} feeWaived={registration.feeWaived} />
        {registration.paymentNeedsReview ? <Badge tone="amber">payment review</Badge> : null}
        {registration.adjustmentStatus === "REQUIRED" ? <Badge tone="amber">balance due</Badge> : null}
        {registration.acmPending ? <Badge tone="blue">{registration.acmPending} ACM to check</Badge> : null}
      </span>
    ),
  },
  {
    key: "amount",
    label: "Amount",
    className: "tabular-nums",
    render: (registration: Registration) => (
      <span>
        {rupees(registration.amountMinor)}
        {registration.refundedAmountMinor ? <span className="text-xs text-muted-foreground"> (−{rupees(registration.refundedAmountMinor)})</span> : null}
      </span>
    ),
  },
]

type BulkAction = "cancel" | "delete"
type BulkResult = { action: BulkAction; done: string[]; skipped: { id: string; team_name: string | null; reason: string }[] }

const statusFilters = [
  { value: "", label: "Active (pending + paid)" },
  { value: "PAID", label: "Paid" },
  { value: "PAYMENT_PENDING", label: "Awaiting payment" },
  { value: "REFUNDED", label: "Refunded (cancelled)" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ABANDONED", label: "Abandoned" },
  { value: "ALL", label: "Everything" },
]

export default function RegistrationsPage() {
  const roles = useMe().data?.user.roles ?? []
  const [date, setDate] = useState<Date>()
  const [category, setCategory] = useState<RegistrationCategory | "all">("all")
  const [status, setStatus] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [openRegistration, setOpenRegistration] = useState<string | null>(null)
  // Super admins can tick rows on the current page and cancel or delete them in one go.
  const bulkAllowed = can.money(roles)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const bulk = useAdminMutation<{ action: BulkAction; ids: string[] }, BulkResult>(
    (body) => ({ path: "/api/admin/registrations/bulk", body }), [["registrations"], ["registration"], ["teams"]]
  )
  const [selectedColumns, setSelectedColumns] = useState<RegistrationColumnKey[]>(
    registrationColumns.map((column) => column.key)
  )

  const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
  // The backend buckets dates in the event time zone, so send the picked calendar day as-is.
  if (date) params.set("date", format(date, "yyyy-MM-dd"))
  if (category !== "all") params.set("category", category)
  if (status) params.set("status", status)
  if (search.trim()) params.set("search", search.trim())
  const query = useQuery({
    queryKey: keys.registrations(params.toString()),
    queryFn: adminQuery(`/api/admin/registrations?${params}`, registrationsPageSchema),
    select: toRegistrationsPage,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
  const data = query.data ?? null
  const loadError = query.isError ? "Registrations could not be loaded." : ""

  const registrations = data?.registrations ?? []
  const chartData = data?.dailyCounts ?? []
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))
  const visibleRegistrations = registrations
  const hasFilters = Boolean(date) || category !== "all" || Boolean(status) || Boolean(search)
  const visibleColumns = registrationColumns.filter((column) =>
    selectedColumns.includes(column.key)
  )
  const chosen = visibleRegistrations.filter((registration) => selected.has(registration.registrationId)).map((registration) => registration.registrationId)
  const allChosen = visibleRegistrations.length > 0 && chosen.length === visibleRegistrations.length

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function runBulk(action: BulkAction) {
    const verb = action === "cancel" ? "cancelled" : "deleted"
    bulk.mutateAsync({ action, ids: chosen })
      .then((result) => {
        setSelected(new Set())
        const summary = `${result.done.length} ${verb}${result.skipped.length ? `, ${result.skipped.length} skipped` : ""}.`
        const details = result.skipped.slice(0, 6).map((row) => `${row.team_name ?? "Unknown"}: ${row.reason}`).join("; ")
        if (result.skipped.length) toast.warning(summary, { description: details + (result.skipped.length > 6 ? `; and ${result.skipped.length - 6} more` : ""), duration: 12_000 })
        else toast.success(summary)
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "The bulk action failed."))
  }

  function resetPage() {
    setPage(1)
  }

  function clearFilters() {
    setDate(undefined)
    setCategory("all")
    setStatus("")
    setSearch("")
    resetPage()
  }

  function setColumnVisible(column: RegistrationColumnKey, checked: boolean) {
    setSelectedColumns((current) => {
      if (checked) {
        return current.includes(column) ? current : [...current, column]
      }

      return current.length === 1 ? current : current.filter((key) => key !== column)
    })
  }

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <div className="admin-fade">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Registrations</h1>
        <p className="text-sm tracking-tighter text-muted-foreground">
          Monitor registration volume and review incoming teams.
        </p>
      </div>

      <section className="admin-rise min-w-0 rounded-2xl glass-shell p-1">
        <div className="min-w-0 rounded-xl bg-card p-3 sm:p-4">
          <div className="mb-3">
            <h2 className="text-lg font-semibold tracking-tight">Registration analytics</h2>
            <p className="text-sm tracking-tighter text-muted-foreground">
              Daily registrations from the table rows below.
            </p>
          </div>
          <figure className="h-56 w-full text-left sm:h-72">
            <AreaChart
              aspectRatio="auto"
              className="h-full"
              data={chartData}
              margin={{ top: 16, right: 16, bottom: 36, left: 16 }}
            >
              <Grid horizontal />
              <Area
                dataKey="adamas"
                fill="var(--chart-line-primary)"
                fillOpacity={0.3}
              />
              <Area
                dataKey="other"
                fill="var(--chart-line-secondary)"
                fillOpacity={0.3}
              />
              <XAxis />
              <ChartTooltip
                rows={(point) => [
                  {
                    color: "var(--chart-line-primary)",
                    label: "Adamas University",
                    value: Number(point.adamas ?? 0),
                  },
                  {
                    color: "var(--chart-line-secondary)",
                    label: "Other colleges",
                    value: Number(point.other ?? 0),
                  },
                ]}
              />
            </AreaChart>
            <figcaption className="sr-only">
              Daily registration counts grouped by college from the current table filters.
            </figcaption>
          </figure>
        </div>
      </section>

      <TeamInvites canInvite={can.review(roles)} />

      <section className="admin-rise min-w-0 rounded-2xl glass-shell p-1">
        <div className="min-w-0 overflow-hidden rounded-xl bg-card p-3 sm:p-4">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">All registrations</h2>
              {loadError ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{loadError}</p> : null}
              <p aria-live="polite" className="text-sm tracking-tighter text-muted-foreground">
                {data?.total ?? 0} matching registration{data?.total === 1 ? "" : "s"}
              </p>
            </div>
            <div className="grid w-full grid-cols-2 items-end gap-2 sm:flex sm:w-auto sm:flex-wrap">
              <label className="col-span-2 flex min-w-0 flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
                Search
                <input
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); resetPage() }}
                  placeholder="Team or leader email"
                  className="h-8 w-full rounded-md sm:w-48 border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
                Status
                <select
                  value={status}
                  onChange={(event) => { setStatus(event.target.value); resetPage() }}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
                >
                  {statusFilters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                {status === "REFUNDED" ? <span>Refunded teams are cancelled and hidden from every other list.</span> : null}
                {status === "REJECTED" ? <span>Rejected free teams; delete them once they are no longer needed.</span> : null}
              </label>
              <div className="flex flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
                <span id="registration-date-label">Registration date</span>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        aria-labelledby="registration-date-label"
                        variant="outline"
                        size="sm"
                        className="h-8 w-full justify-start sm:w-40 rounded-md border-input bg-background normal-case font-normal tracking-tighter"
                      />
                    }
                  >
                    <CalendarIcon />
                    {date ? format(date, "dd MMM yyyy") : "Pick a date"}
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-auto rounded-xl border border-border bg-popover p-0"
                  >
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(selectedDate) => {
                        setDate(selectedDate)
                        resetPage()
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <label className="flex flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
                Category
                <select
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value as RegistrationCategory | "all")
                    resetPage()
                  }}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
                >
                  <option value="all">All categories</option>
                  {registrationCategories.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-md border-input bg-background normal-case font-normal tracking-tighter"
                    >
                      Columns
                    </Button>
                  }
                />
                <DropdownMenuContent
                  align="end"
                  className="w-44 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-pixel-square normal-case tracking-tighter">
                      Visible columns
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {registrationColumns.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.key}
                        checked={selectedColumns.includes(column.key)}
                        disabled={
                          selectedColumns.length === 1 && selectedColumns.includes(column.key)
                        }
                        onCheckedChange={(checked) => setColumnVisible(column.key, checked)}
                        className="font-pixel-square normal-case tracking-tighter"
                      >
                        {column.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <RichButton
                type="button"
                color="zinc"
                size="sm"
                disabled={!hasFilters}
                onClick={clearFilters}
                className="font-pixel-square tracking-tighter"
              >
                Clear filters
              </RichButton>
            </div>
          </div>

          <Bones name="registrations-table" loading={data === null && !loadError}>
          <ul className="admin-stagger divide-y divide-border md:hidden">
            {visibleRegistrations.map((registration) => (
              <li key={registration.registrationId}>
                {/* A div, not a button: boneyard captures buttons as one solid block. */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenRegistration(registration.registrationId)}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpenRegistration(registration.registrationId) } }}
                  aria-label={`Open ${registration.teamName}`}
                  className="flex w-full cursor-pointer flex-col gap-1 rounded-lg px-1 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring active:bg-muted"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">{registration.teamName}</span>
                    <span className="shrink-0 tabular-nums text-sm">{rupees(registration.amountMinor)}</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {registration.leader} · {registration.members} member{registration.members === 1 ? "" : "s"} · {formatDate(registration.registeredAt)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{registration.college}</span>
                  {registrationColumns.find((column) => column.key === "paymentStatus")?.render(registration)}
                </div>
              </li>
            ))}
            {!visibleRegistrations.length ? (
              <li className="py-8 text-center text-sm text-muted-foreground">{loadError || "No registrations match these filters."}</li>
            ) : null}
          </ul>
          {bulkAllowed && chosen.length ? (
            <div role="region" aria-label="Bulk actions" className="mb-3 hidden flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm md:flex">
              <span className="font-medium">{chosen.length} selected</span>
              <ConfirmButton confirmLabel={`Cancel ${chosen.length} unpaid`} disabled={bulk.isPending} onConfirm={() => runBulk("cancel")}>Cancel unpaid</ConfirmButton>
              <ConfirmButton confirmLabel={`Delete ${chosen.length} for good`} disabled={bulk.isPending} onConfirm={() => runBulk("delete")}>Delete abandoned / rejected</ConfirmButton>
              <button type="button" className="text-xs underline underline-offset-2" onClick={() => setSelected(new Set())}>Clear</button>
              <span className="text-xs text-muted-foreground">Teams that do not fit an action (e.g. paid, or with a payment on record) are skipped and listed.</span>
            </div>
          ) : null}
          <div className="hidden md:block">
          <Table className="min-w-max">
            <TableCaption className="sr-only">
              Registrations with date, team, leader, contact, college, team size, ACM status, category, and payment status.
            </TableCaption>
            <TableHeader>
              <TableRow>
                {bulkAllowed ? (
                  <TableHead className="h-10 w-8">
                    <input type="checkbox" aria-label="Select all on this page" checked={allChosen}
                      onChange={(event) => setSelected(event.target.checked ? new Set(visibleRegistrations.map((registration) => registration.registrationId)) : new Set())} />
                  </TableHead>
                ) : null}
                {visibleColumns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={`h-10 normal-case tracking-tighter ${column.className ?? ""}`}
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRegistrations.length ? (
                visibleRegistrations.map((registration) => (
                  <TableRow
                    key={registration.registrationId}
                    tabIndex={0}
                    onClick={() => setOpenRegistration(registration.registrationId)}
                    onKeyDown={(event) => { if (event.key === "Enter") setOpenRegistration(registration.registrationId) }}
                    className="cursor-pointer"
                    aria-label={`Open ${registration.teamName}`}
                  >
                    {bulkAllowed ? (
                      <TableCell className="w-8" onClick={(event) => event.stopPropagation()}>
                        <input type="checkbox" aria-label={`Select ${registration.teamName}`} checked={selected.has(registration.registrationId)}
                          onChange={(event) => toggle(registration.registrationId, event.target.checked)} />
                      </TableCell>
                    ) : null}
                    {visibleColumns.map((column) => (
                      <TableCell key={column.key} className={column.className}>
                        {column.render(registration)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumns.length + (bulkAllowed ? 1 : 0)}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {loadError || "No registrations match these filters."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
          </Bones>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm tracking-tighter text-muted-foreground">
              Showing {visibleRegistrations.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, data?.total ?? 0)} of {data?.total ?? 0}
            </p>
            <nav aria-label="Registration table pagination" className="flex items-center gap-2">
              <RichButton
                type="button"
                color="zinc"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((current) => current - 1)}
                className="font-pixel-square tracking-tighter"
              >
                Previous
              </RichButton>
              <span className="min-w-20 text-center text-sm tracking-tighter text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <RichButton
                type="button"
                color="zinc"
                size="sm"
                disabled={page === pageCount}
                onClick={() => setPage((current) => current + 1)}
                className="font-pixel-square tracking-tighter"
              >
                Next
              </RichButton>
            </nav>
          </div>
        </div>
      </section>
      <RegistrationDrawer registrationId={openRegistration} onClose={() => setOpenRegistration(null)} />
    </div>
  )
}
