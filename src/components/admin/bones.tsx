"use client"

import type { ReactNode } from "react"
import { Skeleton, configureBoneyard } from "boneyard-js/react"

import "@/bones/registry"

// Captures are keyed by viewport width; the sidebar makes containers narrower than the window.
configureBoneyard({ select: "viewport" })

/**
 * A boneyard skeleton shaped like the real content it wraps. Run `npm run bones` after adding a
 * name or changing a wrapped layout, so the captured shape stays in step with the page.
 *
 * No fallback on purpose: boneyard sizes the skeleton from the first height it measures, so a
 * placeholder rendered before the capture resolves would squash it.
 */
export function Bones({ name, loading, children, className }: {
  name: string
  loading: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <Skeleton name={name} loading={loading} className={className}>
      {loading ? null : children}
    </Skeleton>
  )
}
