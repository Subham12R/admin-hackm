"use client"

import { useEffect, useRef, useState } from "react"

function readTerm() {
  if (typeof window === "undefined") return ""
  return new URLSearchParams(window.location.search).get("q") ?? ""
}

function writeTerm(term: string) {
  const url = new URL(window.location.href)
  if (term) url.searchParams.set("q", term)
  else url.searchParams.delete("q")
  window.history.replaceState(window.history.state, "", url)
}

/**
 * One search box per table: the typed text, plus a debounced copy for the query key.
 * The term lives in the URL (?q=) so a reload or a shared link keeps it.
 * (Reads window.location instead of useSearchParams, so pages need no Suspense boundary.)
 */
export function useTableSearch(onChange?: () => void, delay = 300) {
  const [value, setValue] = useState("")
  const [term, setTerm] = useState("")
  const current = useRef("")
  const changed = useRef(onChange)
  useEffect(() => { changed.current = onChange })

  // The URL is only readable after hydration, so pick up a shared ?q= on the next tick.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const initial = readTerm()
      if (!initial) return
      current.current = initial.trim()
      setValue(initial)
      setTerm(initial.trim())
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = value.trim()
      if (current.current === next) return
      current.current = next
      setTerm(next)
      changed.current?.()
      writeTerm(next)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return { value, setValue, term }
}
