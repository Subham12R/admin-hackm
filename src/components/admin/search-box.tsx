"use client"

import { Search, X } from "lucide-react"

/** The shared table search field; pair it with useTableSearch. */
export function SearchBox({ value, onChange, placeholder, label = "Search", className = "" }: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label?: string
  className?: string
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 text-xs tracking-tighter text-muted-foreground ${className}`}>
      {label}
      <span className="relative flex items-center">
        <Search aria-hidden="true" className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Escape") onChange("") }}
          placeholder={placeholder}
          className="h-8 w-full rounded-md border border-input bg-background pr-7 pl-7 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-56 [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button type="button" aria-label="Clear search" onClick={() => onChange("")} className="absolute right-1.5 rounded p-0.5 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        ) : null}
      </span>
    </label>
  )
}
