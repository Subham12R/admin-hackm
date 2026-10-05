export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

/** Same-origin JSON call to this app's BFF; throws ApiError with the backend's message. */
export async function api<T>(path: string, init?: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<T> {
  const response = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body === undefined ? undefined : { "content-type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init?.signal,
    cache: "no-store",
  })
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "The request could not be completed."
    throw new ApiError(response.status, message)
  }
  return data as T
}

export function errorMessage(error: unknown, fallback = "Something went wrong.") {
  return error instanceof ApiError ? error.message : fallback
}

export function rupees(minor: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(minor / 100)
}

export function dateTime(value: string | null | undefined) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value))
}

/** ISO instant -> value for <input type="datetime-local"> in IST. */
export function toLocalInput(value: string | null | undefined) {
  if (!value) return ""
  const shifted = new Date(new Date(value).getTime() + 330 * 60_000)
  return shifted.toISOString().slice(0, 16)
}

/** <input type="datetime-local"> value interpreted as IST -> ISO instant with offset. */
export function fromLocalInput(value: string) {
  return value ? `${value}:00+05:30` : null
}
