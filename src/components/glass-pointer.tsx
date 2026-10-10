"use client"

import { useEffect } from "react"

const GLASS_SELECTOR = ".glass-shell"

// Feeds the pointer position into the nearest glass surface so its specular highlight follows the cursor.
export function GlassPointer() {
  useEffect(() => {
    let frame = 0
    let event: PointerEvent | null = null

    function update() {
      frame = 0
      if (!event || !(event.target instanceof Element)) return
      const surface = event.target.closest<HTMLElement>(GLASS_SELECTOR)
      if (!surface) return
      const rect = surface.getBoundingClientRect()
      surface.style.setProperty("--glass-x", `${event.clientX - rect.left}px`)
      surface.style.setProperty("--glass-y", `${event.clientY - rect.top}px`)
    }

    function onPointerMove(next: PointerEvent) {
      if (next.pointerType === "touch") return
      event = next
      if (!frame) frame = requestAnimationFrame(update)
    }

    document.addEventListener("pointermove", onPointerMove, { passive: true })
    return () => {
      document.removeEventListener("pointermove", onPointerMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
