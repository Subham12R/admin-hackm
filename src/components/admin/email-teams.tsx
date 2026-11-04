"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Mail } from "lucide-react"

import { Button } from "@/components/admin/kit"
import { handTeamsToEmail } from "@/components/admin/to-field"
import { api, errorMessage } from "@/lib/api"
import { toast } from "@/lib/notify"

/**
 * "Email all matching": every team the table's search and filters match, across all pages.
 * `filters` is the table's query string without page / page_size.
 */
export function EmailMatching({ filters, total }: { filters: URLSearchParams; total: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function go() {
    setBusy(true)
    try {
      const query = new URLSearchParams(filters)
      query.delete("page")
      query.delete("page_size")
      const result = await api<{ ids: string[]; truncated: boolean }>(`/api/admin/teams/ids?${query}`)
      if (!result.ids.length) {
        toast.error("No teams match these filters.")
        return
      }
      if (result.truncated) toast.warning("Only the first 2,000 teams were added.")
      handTeamsToEmail(result.ids, router.push)
    } catch (error) {
      toast.error(errorMessage(error, "The matching teams could not be loaded."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button disabled={busy || total === 0} onClick={() => void go()} title="Open a new email with every matching team in the To field">
      <Mail className="mr-1 inline size-3.5" aria-hidden="true" />{busy ? "Loading…" : `Email ${total} matching`}
    </Button>
  )
}

export function EmailSelected({ ids }: { ids: string[] }) {
  const router = useRouter()
  return (
    <Button tone="green" onClick={() => handTeamsToEmail(ids, router.push)}>
      <Mail className="mr-1 inline size-3.5" aria-hidden="true" />Email {ids.length} selected
    </Button>
  )
}
