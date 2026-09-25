"use client"

import { Fragment, type ReactNode, useMemo, useState } from "react"

import { format } from "date-fns"
import { CalendarIcon, EllipsisVertical } from "lucide-react"

import { BarChart } from "@/components/charts/bar-chart"
import { Bar } from "@/components/charts/bar"
import { BarXAxis } from "@/components/charts/bar-x-axis"
import { Grid } from "@/components/charts/grid"
import { ChartTooltip } from "@/components/charts/tooltip"
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
type DetailsReviewStatus = "Verified" | "Declined"

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
}

const registrations = [
  { registeredAt: "2026-11-07", teamName: "Binary Beacons", leader: "Aarav Sen", email: "aarav.sen@example.com", phone: "+91 98310 42165", college: "Adamas University", members: 4, acm: "Yes", acmMembers: 3, category: "Adamas ACM" },
  { registeredAt: "2026-11-07", teamName: "Stack Sprinters", leader: "Ishita Roy", email: "ishita.roy@example.com", phone: "+91 98745 10326", college: "Jadavpur University", members: 3, acm: "No", category: "Outer college" },
  { registeredAt: "2026-11-07", teamName: "Pixel Pioneers", leader: "Rohan Das", email: "rohan.das@example.com", phone: "+91 90071 62548", college: "Adamas University", members: 2, acm: "Yes", acmMembers: 1, category: "Adamas ACM" },
  { registeredAt: "2026-11-06", teamName: "Logic Loom", leader: "Sneha Paul", email: "sneha.paul@example.com", phone: "+91 89102 30714", college: "Heritage Institute of Technology", members: 4, acm: "No", category: "Outer college" },
  { registeredAt: "2026-11-06", teamName: "Code Catalysts", leader: "Arjun Ghosh", email: "arjun.ghosh@example.com", phone: "+91 98367 49021", college: "Adamas University", members: 3, acm: "No", category: "Adamas only" },
  { registeredAt: "2026-11-06", teamName: "Null Pointers", leader: "Mira Dutta", email: "mira.dutta@example.com", phone: "+91 99031 86425", college: "Techno India University", members: 2, acm: "Yes", acmMembers: 2, category: "Outer + ACM" },
  { registeredAt: "2026-11-05", teamName: "Byte Brigade", leader: "Kabir Shah", email: "kabir.shah@example.com", phone: "+91 97480 51362", college: "Adamas University", members: 4, acm: "Yes", acmMembers: 4, category: "Adamas ACM" },
  { registeredAt: "2026-11-05", teamName: "Runtime Rebels", leader: "Nandini Bose", email: "nandini.bose@example.com", phone: "+91 90731 48269", college: "Narula Institute of Technology", members: 3, acm: "No", category: "Outer college" },
  { registeredAt: "2026-11-04", teamName: "Circuit Crew", leader: "Dev Mallick", email: "dev.mallick@example.com", phone: "+91 98312 67504", college: "Adamas University", members: 2, acm: "No", category: "Adamas only" },
  { registeredAt: "2026-11-04", teamName: "Kernel Knights", leader: "Tanya Mitra", email: "tanya.mitra@example.com", phone: "+91 89614 23058", college: "University of Calcutta", members: 4, acm: "Yes", acmMembers: 2, category: "Outer + ACM" },
  { registeredAt: "2026-11-03", teamName: "Loop Legends", leader: "Ritwik Dey", email: "ritwik.dey@example.com", phone: "+91 98365 49120", college: "Adamas University", members: 3, acm: "Yes", acmMembers: 1, category: "Adamas ACM" },
  { registeredAt: "2026-11-03", teamName: "Data Drifters", leader: "Ananya Basu", email: "ananya.basu@example.com", phone: "+91 90079 32184", college: "MAKAUT", members: 4, acm: "No", category: "Outer college" },
] satisfies Registration[]

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

type RegistrationColumn = {
  key: RegistrationColumnKey
  label: string
  className?: string
  defaultVisible?: boolean
  render: (registration: Registration) => ReactNode
}

type TeamMember = {
  name: string
  email: string
  phone: string
  college: string
  acm: "Yes" | "No"
  acmId: string | null
}

const registrationColumns: readonly RegistrationColumn[] = [
  { key: "registeredAt", label: "Date", defaultVisible: false, render: (registration: Registration) => formatDate(registration.registeredAt) },
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
  { key: "category", label: "Category", defaultVisible: false, render: (registration: Registration) => registration.category },
]

const memberNames = [
  "Aditi Pal",
  "Rohan Dey",
  "Maya Saha",
  "Kunal Roy",
  "Ira Ghosh",
  "Neel Das",
] as const

function acmIdFor(email: string, isAcmMember: boolean) {
  return isAcmMember
    ? `ACM-${email.replaceAll(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase()}`
    : null
}

function getTeamMembers(registration: Registration): TeamMember[] {
  const slug = registration.teamName.toLowerCase().replaceAll(" ", "-")

  return Array.from({ length: registration.members - 1 }, (_, index) => {
    const acm =
      registration.acm === "Yes" && index < (registration.acmMembers ?? 1) - 1
        ? "Yes"
        : "No"
    const email = `${slug}-member-${index + 1}@example.com`

    return {
      name: memberNames[(registration.teamName.length + index) % memberNames.length],
      email,
      phone: `+91 90000 ${String(registration.teamName.length * 97 + index).padStart(5, "0")}`,
      college: registration.college,
      acm,
      acmId: acmIdFor(email, acm === "Yes"),
    }
  })
}

export default function TeamsPage() {
  const [date, setDate] = useState<Date>()
  const [category, setCategory] = useState<RegistrationCategory | "all">("all")
  const [page, setPage] = useState(1)
  const [expandedRegistration, setExpandedRegistration] = useState<string | null>(null)
  const [detailsReviewByEmail, setDetailsReviewByEmail] = useState<
    Record<string, DetailsReviewStatus>
  >({})
  const [selectedColumns, setSelectedColumns] = useState<RegistrationColumnKey[]>(
    registrationColumns
      .filter((column) => column.defaultVisible !== false)
      .map((column) => column.key)
  )

  const filteredRegistrations = useMemo(
    () =>
      registrations.filter(
        (registration) =>
          (!date || registration.registeredAt === format(date, "yyyy-MM-dd")) &&
          (category === "all" || registration.category === category)
      ),
    [category, date]
  )
  const chartData = useMemo(() => {
    const countsByDate = new Map<string, number>()

    for (const registration of filteredRegistrations) {
      countsByDate.set(
        registration.registeredAt,
        (countsByDate.get(registration.registeredAt) ?? 0) + 1
      )
    }

    return [...countsByDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ day: formatDate(date), value }))
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
        <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
        <p className="text-sm tracking-tighter text-muted-foreground">
          Monitor team activity and review team details.
        </p>
      </div>

      <section className="rounded-2xl bg-zinc-100 p-1">
        <div className="rounded-xl bg-white p-4">
          <div className="mb-3">
            <h2 className="text-lg font-semibold tracking-tight">Team analytics</h2>
            <p className="text-sm tracking-tighter text-muted-foreground">
              Daily team counts from the table rows below.
            </p>
          </div>
          <figure className="w-full text-left">
            <BarChart
              aspectRatio="4 / 1"
              barGap={0.1}
              data={chartData}
              margin={{ top: 8, right: 8, bottom: 40, left: 8 }}
              xDataKey="day"
            >
              <Grid horizontal />
              <Bar dataKey="value" lineCap="butt" />
              <BarXAxis maxLabels={8} />
              <ChartTooltip
                rows={(point) => [
                  {
                    color: "var(--chart-line-primary)",
                    label: "Teams",
                    value: Number(point.value ?? 0),
                  },
                ]}
              />
            </BarChart>
            <figcaption className="sr-only">
              Daily team counts from the current table filters.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="min-w-0 rounded-2xl bg-zinc-100 p-1">
        <div className="min-w-0 overflow-hidden rounded-xl bg-white p-4">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">All teams</h2>
              <p aria-live="polite" className="text-sm tracking-tighter text-muted-foreground">
                {filteredRegistrations.length} matching team{filteredRegistrations.length === 1 ? "" : "s"}
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

          <Table className="min-w-[1200px]">
            <TableCaption className="sr-only">
              Registrations with date, team, leader, contact, college, team size, ACM status, and category.
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
                <TableHead className="sticky right-0 z-10 h-10 bg-white">
                  <span className="sr-only">Team details</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRegistrations.length ? (
                visibleRegistrations.map((registration) => {
                  const isExpanded = expandedRegistration === registration.email
                  const teamMembers = getTeamMembers(registration)

                  return (
                    <Fragment key={registration.email}>
                      <TableRow>
                        {visibleColumns.map((column) => (
                          <TableCell key={column.key} className={column.className}>
                            {column.render(registration)}
                          </TableCell>
                        ))}
                        <TableCell className="sticky right-0 z-10 bg-white text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-expanded={isExpanded}
                            aria-label={`${isExpanded ? "Hide" : "Show"} team details for ${registration.teamName}`}
                            title="Team details"
                            onClick={() =>
                              setExpandedRegistration((current) =>
                                current === registration.email ? null : registration.email
                              )
                            }
                            className="rounded-md"
                          >
                            <EllipsisVertical />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isExpanded ? (
                        <TableRow className="bg-zinc-50 hover:bg-zinc-50">
                          <TableCell colSpan={visibleColumns.length + 1} className="whitespace-normal p-4">
                            <div className="space-y-4">
                              <div className="flex flex-wrap items-end justify-between gap-3">
                                <div>
                                  <h3 className="font-medium tracking-tight">Team details</h3>
                                  <p className="text-sm tracking-tighter text-muted-foreground">
                                    {registration.teamName} · {registration.members} participants
                                  </p>
                                </div>
                                <label className="flex flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
                                  Details review
                                  <select
                                    aria-label={`Details review for ${registration.teamName}`}
                                    value={detailsReviewByEmail[registration.email] ?? ""}
                                    onChange={(event) =>
                                      setDetailsReviewByEmail((current) => ({
                                        ...current,
                                        [registration.email]: event.target.value as DetailsReviewStatus,
                                      }))
                                    }
                                    className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                                  >
                                    <option value="" disabled>Pending review</option>
                                    <option value="Verified">Verified</option>
                                    <option value="Declined">Declined</option>
                                  </select>
                                </label>
                              </div>
                              <Table className="min-w-[820px]">
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="h-10 normal-case tracking-tighter">Name</TableHead>
                                    <TableHead className="h-10 normal-case tracking-tighter">Role</TableHead>
                                    <TableHead className="h-10 normal-case tracking-tighter">Email</TableHead>
                                    <TableHead className="h-10 normal-case tracking-tighter">Phone</TableHead>
                                    <TableHead className="h-10 normal-case tracking-tighter">College</TableHead>
                                    <TableHead className="h-10 normal-case tracking-tighter">ACM</TableHead>
                                    <TableHead className="h-10 normal-case tracking-tighter">ACM ID</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  <TableRow>
                                    <TableCell className="font-medium">{registration.leader}</TableCell>
                                    <TableCell>Team leader</TableCell>
                                    <TableCell>{registration.email}</TableCell>
                                    <TableCell>{registration.phone}</TableCell>
                                    <TableCell>{registration.college}</TableCell>
                                    <TableCell>{registration.acm}</TableCell>
                                    <TableCell>{acmIdFor(registration.email, registration.acm === "Yes") ?? "—"}</TableCell>
                                  </TableRow>
                                  {teamMembers.map((member) => (
                                    <TableRow key={member.email}>
                                      <TableCell className="font-medium">{member.name}</TableCell>
                                      <TableCell>Member</TableCell>
                                      <TableCell>{member.email}</TableCell>
                                      <TableCell>{member.phone}</TableCell>
                                      <TableCell>{member.college}</TableCell>
                                      <TableCell>{member.acm}</TableCell>
                                      <TableCell>{member.acmId ?? "—"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumns.length + 1}
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
            <nav aria-label="Team table pagination" className="flex items-center gap-2">
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
