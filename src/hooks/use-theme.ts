import * as React from "react"

import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme"

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return stored === "dark" || stored === "light" ? stored : null
  } catch {
    return null
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
  root.style.colorScheme = theme
}

function subscribe(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => observer.disconnect()
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function getServerSnapshot(): Theme {
  return "light"
}

export function useTheme() {
  const theme = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Strict Mode's dev remount resets <html> attributes, dropping the class the inline script set.
  React.useLayoutEffect(() => {
    const stored = readStoredTheme()
    if (stored) applyTheme(stored)
  }, [])

  const setTheme = React.useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {}

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!document.startViewTransition || reduceMotion) {
      applyTheme(next)
      return
    }
    document.startViewTransition(() => applyTheme(next))
  }, [])

  const toggleTheme = React.useCallback(() => {
    setTheme(getSnapshot() === "dark" ? "light" : "dark")
  }, [setTheme])

  return { theme, setTheme, toggleTheme }
}
