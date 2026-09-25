"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"

import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { Area, AreaChart } from "@/components/charts/area-chart"
import { Grid } from "@/components/charts/grid"
import { ChartTooltip } from "@/components/charts/tooltip"
import { XAxis } from "@/components/charts/x-axis"
import { RichButton } from "@/components/rich-button"
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

const categories = [
  "Adamas ACM",
  "Adamas only",
  "Outer college",
  "Outer + ACM",
] as const

type RegistrationCategory = (typeof categories)[number]
type PaymentStatus = "Success" | "Failed" | "Pending"

type Registration = {
  registeredAt: string
  teamName: string
  leader: string
  email: string
  phone: string
  college: string
  members: number
  acm: "Yes" | "No"
  acmMembers?: number
  category: RegistrationCategory
  paymentStatus: PaymentStatus
}

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
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs tracking-tighter text-zinc-700">
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
    render: (registration: Registration) => {
      const status = registration.paymentStatus
      return (
        <span
          className={`rounded-md px-2 py-1 text-xs tracking-tighter ${status === "Success" ? "bg-emerald-50 text-emerald-700" : status === "Pending" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}
        >
          {status}
        </span>
      )
    },
  },
]

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loadError, setLoadError] = useState("")
  const [date, setDate] = useState<Date>()
  const [category, setCategory] = useState<RegistrationCategory | "all">("all")
  const [page, setPage] = useState(1)
  const [selectedColumns, setSelectedColumns] = useState<RegistrationColumnKey[]>(
    registrationColumns.map((column) => column.key)
  )

  useEffect(() => {
    fetch("/api/admin/registrations")
      .then(async (response) => {
        if (!response.ok) throw new Error("registrations unavailable")
        return response.json()
      })
      .then((data) => {
        setRegistrations(data.registrations.map((row: {
          registered_at: string
          team_name: string
          leader: string
          email: string
          phone: string
          college: string
          members: number
          acm: "Yes" | "No"
          acm_members: number
          category: RegistrationCategory
          status: string
        }) => ({
          registeredAt: row.registered_at,
          teamName: row.team_name,
          leader: row.leader,
          email: row.email,
          phone: row.phone,
          college: row.college,
          members: row.members,
          acm: row.acm,
          acmMembers: row.acm_members,
          category: row.category,
          paymentStatus: row.status === "PAID" ? "Success" : row.status === "CANCELLED" ? "Failed" : "Pending",
        })))
      })
      .catch(() => setLoadError("Registrations could not be loaded."))
  }, [])

  const filteredRegistrations = useMemo(
    () =>
      registrations.filter(
        (registration) =>
          (!date || registration.registeredAt === format(date, "yyyy-MM-dd")) &&
          (category === "all" || registration.category === category)
      ),
    [category, date, registrations]
  )
  const chartData = useMemo(() => {
    const countsByDate = new Map<string, { date: string; adamas: number; other: number }>()

    for (const registration of filteredRegistrations) {
      const point = countsByDate.get(registration.registeredAt) ?? {
        date: registration.registeredAt,
        adamas: 0,
        other: 0,
      }

      if (registration.college === "Adamas University") {
        point.adamas += 1
      } else {
        point.other += 1
      }

      countsByDate.set(registration.registeredAt, point)
    }

    return [...countsByDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredRegistrations])
  const pageCount = Math.max(1, Math.ceil(filteredRegistrations.length / PAGE_SIZE))
  const visibleRegistrations = filteredRegistrations.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  )
  const hasFilters = Boolean(date) || category !== "all"
  const visibleColumns = registrationColumns.filter((column) =>
    selectedColumns.includes(column.key)
  )

  function resetPage() {
    setPage(1)
  }

  function clearFilters() {
    setDate(undefined)
    setCategory("all")
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Registrations</h1>
        <p className="text-sm tracking-tighter text-muted-foreground">
          Monitor registration volume and review incoming teams.
        </p>
      </div>

      <section className="rounded-2xl bg-zinc-100 p-1">
        <div className="rounded-xl bg-white p-4">
          <div className="mb-3">
            <h2 className="text-lg font-semibold tracking-tight">Registration analytics</h2>
            <p className="text-sm tracking-tighter text-muted-foreground">
              Daily registrations from the table rows below.
            </p>
          </div>
          <figure className="h-72 w-full text-left">
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

      <section className="min-w-0 rounded-2xl bg-zinc-100 p-1">
        <div className="min-w-0 overflow-hidden rounded-xl bg-white p-4">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">All registrations</h2>
              {loadError ? <p role="alert" className="text-sm text-red-600">{loadError}</p> : null}
              <p aria-live="polite" className="text-sm tracking-tighter text-muted-foreground">
                {filteredRegistrations.length} matching registration{filteredRegistrations.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
                <span id="registration-date-label">Registration date</span>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        aria-labelledby="registration-date-label"
                        variant="outline"
                        size="sm"
                        className="h-8 w-40 justify-start rounded-md border-zinc-200 bg-white normal-case font-normal tracking-tighter"
                      />
                    }
                  >
                    <CalendarIcon />
                    {date ? format(date, "dd MMM yyyy") : "Pick a date"}
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-auto rounded-xl border border-zinc-200 bg-white p-0"
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
                  className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  <option value="all">All categories</option>
                  {categories.map((option) => (
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
                      className="h-8 rounded-md border-zinc-200 bg-white normal-case font-normal tracking-tighter"
                    >
                      Columns
                    </Button>
                  }
                />
                <DropdownMenuContent
                  align="end"
                  className="w-44 rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-900 shadow-xl"
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

          <Table className="min-w-max">
            <TableCaption className="sr-only">
              Registrations with date, team, leader, contact, college, team size, ACM status, category, and payment status.
            </TableCaption>
            <TableHeader>
              <TableRow>
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
                  <TableRow key={registration.email}>
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
                    colSpan={visibleColumns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No registrations match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
            <p className="text-sm tracking-tighter text-muted-foreground">
              Showing {visibleRegistrations.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filteredRegistrations.length)} of {filteredRegistrations.length}
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
    </div>
  )
}
