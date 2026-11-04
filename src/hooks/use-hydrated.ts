import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/**
 * False on the server and during hydration, true after. Role-gated controls use it so the first
 * client render matches the server's HTML even when the signed-in user loaded mid-hydration.
 */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
