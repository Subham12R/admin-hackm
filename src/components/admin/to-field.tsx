"use client"

import { useEffect, useRef, useState } from "react"
import { Mail, Users, X } from "lucide-react"

import { Badge, Field, Select } from "@/components/admin/kit"
import { api, errorMessage } from "@/lib/api"
import { useStages } from "@/lib/stages"

export type Scope = "LEADERS" | "MEMBERS"
export type ExtraRecipient = { email: string; name?: string; team_name?: string; registration_id?: string | null }
export type Segment = { key: string; label: string; needs_stage: boolean }
/** The To field as the backend stores it on a campaign. */
export type Audience = {
  audience: string
  audience_scope: Scope
  segment_stage_id: string | null
  team_ids: string[]
  extra_recipients: ExtraRecipient[]
}
export type Resolved = {
  count: number
  by_source: Record<string, number>
  sample: { email: string; name: string; team_name: string; source: string }[]
  max: number
  teams: { registration_id: string; team_name: string; status: string }[]
}

type People = {
  people: { email: string; name: string; role: string; team_name: string; registration_id: string; status: string }[]
  teams: { registration_id: string; team_name: string; status: string; members: number }[]
}

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/

/** Split pasted text ("a@x.com, Bo <b@y.com>; c@z.com") into addresses; returns the ones that look valid and the rest. */
export function parseEmails(text: string) {
  const valid: string[] = []
  const invalid: string[] = []
  for (const raw of text.split(/[\n,;]+/)) {
    const part = raw.trim()
    if (!part) continue
    const address = (part.match(/<([^>]+)>/)?.[1] ?? part).trim().toLowerCase()
    if (EMAIL.test(address)) valid.push(address)
    else invalid.push(part)
  }
  return { valid, invalid }
}

/** The resolved recipient list for a To field, refreshed 400 ms after it changes. */
export function useResolved(value: Audience) {
  const [state, setState] = useState<{ data: Resolved | null; error: string }>({ data: null, error: "" })
  const payload = JSON.stringify(value)
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      api<Resolved>("/api/admin/email-campaigns/recipients", { method: "POST", body: JSON.parse(payload), signal: controller.signal })
        .then((data) => setState({ data, error: "" }))
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setState((current) => ({ ...current, error: errorMessage(error, "Recipients could not be counted.") }))
        })
    }, 400)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [payload])
  return state
}

/**
 * Who an email goes to: an optional segment, picked teams, and people (registered members or any typed address).
 * Typing searches registered teams and members; Enter or a paste adds typed addresses.
 */
export function ToField({ value, onChange, segments, resolved }: {
  value: Audience
  onChange: (next: Audience) => void
  segments: Segment[]
  resolved: { data: Resolved | null; error: string }
}) {
  const stages = useStages()
  const [text, setText] = useState("")
  const [results, setResults] = useState<People | null>(null)
  const [invalid, setInvalid] = useState<string[]>([])
  const [showList, setShowList] = useState(false)
  // Names for picked teams: from the typeahead, or from the server for a reopened draft.
  const [teamNames, setTeamNames] = useState<Record<string, string>>({})
  const input = useRef<HTMLInputElement>(null)
  const segment = segments.find((item) => item.key === value.audience)
  const names = { ...Object.fromEntries((resolved.data?.teams ?? []).map((team) => [team.registration_id, team.team_name])), ...teamNames }

  useEffect(() => {
    const term = text.trim()
    if (term.length < 2 || EMAIL.test(term)) {
      const timer = window.setTimeout(() => setResults(null), 0)
      return () => window.clearTimeout(timer)
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      api<People>(`/api/admin/email-campaigns/people?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then(setResults)
        .catch(() => undefined)
    }, 250)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [text])

  function set(next: Partial<Audience>) {
    onChange({ ...value, ...next })
  }

  function addPeople(people: ExtraRecipient[]) {
    const known = new Set(value.extra_recipients.map((item) => item.email))
    const fresh = people.filter((person) => !known.has(person.email) && known.add(person.email))
    if (fresh.length) set({ extra_recipients: [...value.extra_recipients, ...fresh] })
  }

  function addTyped(raw: string) {
    const { valid, invalid: bad } = parseEmails(raw)
    addPeople(valid.map((email) => ({ email })))
    setInvalid(bad)
    setText(bad.join(", "))
  }

  function addTeam(team: { registration_id: string; team_name: string }) {
    setTeamNames((current) => ({ ...current, [team.registration_id]: team.team_name }))
    if (!value.team_ids.includes(team.registration_id)) set({ team_ids: [...value.team_ids, team.registration_id] })
    setText("")
    input.current?.focus()
  }

  const total = resolved.data?.count ?? null
  const over = resolved.data ? resolved.data.count > resolved.data.max : false

  return (
    <div className="grid gap-3 rounded-lg border border-border p-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field label="Segment" hint="A rule over this edition's teams. Pick Nobody to send only to the people you add below.">
          <Select value={value.audience} onChange={(event) => set({ audience: event.target.value, segment_stage_id: segments.find((item) => item.key === event.target.value)?.needs_stage ? value.segment_stage_id ?? stages.data?.items[0]?.id ?? null : null })}>
            {segments.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </Select>
        </Field>
        <Field label="Who in each team">
          <Select value={value.audience_scope} onChange={(event) => set({ audience_scope: event.target.value as Scope })}>
            <option value="LEADERS">Team leaders</option>
            <option value="MEMBERS">Every member</option>
          </Select>
        </Field>
      </div>
      {segment?.needs_stage ? (
        <Field label="Event">
          <Select value={value.segment_stage_id ?? ""} onChange={(event) => set({ segment_stage_id: event.target.value || null })}>
            {(stages.data?.items ?? []).map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </Select>
        </Field>
      ) : null}

      <div className="flex min-w-0 flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
        <span id="to-field-label">Add teams or people</span>
        <div className="relative">
          <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-background p-1 focus-within:ring-2 focus-within:ring-ring">
            {value.team_ids.map((id) => (
              <Chip key={id} icon="team" label={names[id] ?? "Team"} hint={value.audience_scope === "LEADERS" ? "leader" : "all members"}
                onRemove={() => set({ team_ids: value.team_ids.filter((item) => item !== id) })} />
            ))}
            {value.extra_recipients.map((person) => (
              <Chip key={person.email} icon="person" label={person.name ? `${person.name} <${person.email}>` : person.email}
                onRemove={() => set({ extra_recipients: value.extra_recipients.filter((item) => item.email !== person.email) })} />
            ))}
            <input
              ref={input}
              aria-labelledby="to-field-label"
              value={text}
              onChange={(event) => { setText(event.target.value); setInvalid([]) }}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === ",") && text.trim()) {
                  event.preventDefault()
                  addTyped(text)
                } else if (event.key === "Backspace" && !text) {
                  if (value.extra_recipients.length) set({ extra_recipients: value.extra_recipients.slice(0, -1) })
                  else if (value.team_ids.length) set({ team_ids: value.team_ids.slice(0, -1) })
                }
              }}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData("text")
                if (/[\n,;]/.test(pasted)) {
                  event.preventDefault()
                  addTyped(pasted)
                }
              }}
              placeholder={value.team_ids.length || value.extra_recipients.length ? "Add more…" : "Search a team or member, or type / paste emails"}
              className="h-7 min-w-48 flex-1 bg-transparent px-1 text-sm text-foreground outline-none"
            />
          </div>
          {results && (results.teams.length || results.people.length) ? (
            <ul role="listbox" aria-label="Matching teams and people" className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-md border border-border bg-popover p-1 text-sm text-foreground shadow-lg">
              {results.teams.map((team) => (
                <li key={team.registration_id}>
                  <button type="button" onClick={() => addTeam(team)} className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-muted">
                    <span className="flex items-center gap-2"><Users className="size-3.5" />{team.team_name}</span>
                    <span className="text-xs text-muted-foreground">team · {team.members} members · {team.status.toLowerCase().replace("_", " ")}</span>
                  </button>
                </li>
              ))}
              {results.people.map((person) => (
                <li key={`${person.registration_id}-${person.email}`}>
                  <button type="button" onClick={() => { addPeople([{ email: person.email, name: person.name, team_name: person.team_name, registration_id: person.registration_id }]); setText("") }}
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-muted">
                    <span className="flex min-w-0 items-center gap-2"><Mail className="size-3.5 shrink-0" /><span className="truncate">{person.name} &lt;{person.email}&gt;</span></span>
                    <span className="shrink-0 text-xs text-muted-foreground">{person.role} · {person.team_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {invalid.length ? <span className="text-red-600">Not an email address: {invalid.join(", ")}</span> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {resolved.error ? <span className="text-red-600">{resolved.error}</span> : total === null ? <span className="text-muted-foreground">Counting…</span> : (
          <>
            <span className={over ? "font-medium text-red-600" : "font-medium"}>{total} {total === 1 ? "person" : "people"}</span>
            {Object.entries(resolved.data?.by_source ?? {}).map(([source, count]) => (
              <Badge key={source}>{count} {source === "SEGMENT" ? "from the segment" : source === "TEAM" ? "from picked teams" : "added"}</Badge>
            ))}
            {over ? <span className="text-red-600">One email can go to at most {resolved.data?.max}.</span> : null}
            {total ? (
              <button type="button" className="text-xs underline underline-offset-2" onClick={() => setShowList((current) => !current)} aria-expanded={showList}>
                {showList ? "Hide list" : "Show list"}
              </button>
            ) : null}
          </>
        )}
      </div>
      {showList && resolved.data ? (
        <ul className="max-h-56 overflow-auto rounded-md bg-muted/40 p-2 text-xs">
          {resolved.data.sample.map((person) => (
            <li key={person.email} className="flex justify-between gap-2 py-0.5">
              <span className="truncate">{person.name} &lt;{person.email}&gt;</span>
              <span className="shrink-0 text-muted-foreground">{person.team_name || "no team"}</span>
            </li>
          ))}
          {resolved.data.count > resolved.data.sample.length ? <li className="pt-1 text-muted-foreground">and {resolved.data.count - resolved.data.sample.length} more</li> : null}
        </ul>
      ) : null}
    </div>
  )
}

function Chip({ icon, label, hint, onRemove }: { icon: "team" | "person"; label: string; hint?: string; onRemove: () => void }) {
  const Icon = icon === "team" ? Users : Mail
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
      {hint ? <span className="text-muted-foreground">({hint})</span> : null}
      <button type="button" aria-label={`Remove ${label}`} onClick={onRemove} className="rounded-full p-0.5 hover:bg-foreground/10"><X className="size-3" /></button>
    </span>
  )
}

/** Hand selected teams from a table to the Email page (sessionStorage, so long selections don't bloat the URL). */
export const HANDOFF_KEY = "hm:email-teams"

export function handTeamsToEmail(ids: string[], navigate: (href: string) => void, scope: Scope = "MEMBERS") {
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ ids, scope }))
  } catch {
    // Private mode: the Email page simply opens empty.
  }
  navigate("/dashboard/emails?compose=teams")
}

export function takeHandedTeams(): { ids: string[]; scope: Scope } | null {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY)
    sessionStorage.removeItem(HANDOFF_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { ids?: unknown; scope?: unknown }
    if (!Array.isArray(parsed.ids)) return null
    return { ids: parsed.ids.filter((id): id is string => typeof id === "string"), scope: parsed.scope === "LEADERS" ? "LEADERS" : "MEMBERS" }
  } catch {
    return null
  }
}
