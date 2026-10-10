"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { Button, ConfirmButton, Field, LoadingRows, Notice, Panel, TextInput } from "@/components/admin/kit"
import { api, dateTime, errorMessage } from "@/lib/api"
import { notify, toast } from "@/lib/notify"
import { useAdminQuery } from "@/lib/queries"

type Preview = { phrase: string; counts: Record<string, number> }

/**
 * Owner-only. Three independent proofs before anything is deleted: a code emailed to the owner,
 * the owner's password, and the confirmation phrase typed by hand (pasting is blocked).
 */
export function FlushPanel() {
  const client = useQueryClient()
  const preview = useAdminQuery<Preview>(["owner-flush"], "/api/admin/owner/flush")
  const [codeSent, setCodeSent] = useState<{ to: string; expires: string } | null>(null)
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [phrase, setPhrase] = useState("")
  const [busy, setBusy] = useState(false)
  const data = preview.data
  const ready = Boolean(data) && phrase === data?.phrase && /^\d{6}$/.test(code) && password.length > 0 && Boolean(codeSent)

  async function sendCode() {
    setBusy(true)
    try {
      const sent = await api<{ sent_to: string; expires_at: string }>("/api/admin/owner/flush/code", { method: "POST" })
      setCodeSent({ to: sent.sent_to, expires: sent.expires_at })
      toast.success(`Code sent to ${sent.sent_to}.`)
    } catch (error) {
      toast.error(errorMessage(error, "The code could not be sent."))
    } finally {
      setBusy(false)
    }
  }

  async function flush() {
    setBusy(true)
    await notify(
      api("/api/admin/owner/flush", { method: "POST", body: { password, code, confirmation: phrase } }),
      "All event data was flushed.",
      () => {
        setCode("")
        setPassword("")
        setPhrase("")
        setCodeSent(null)
        void client.invalidateQueries()
      }
    ).finally(() => setBusy(false))
  }

  return (
    <Panel title="Danger zone: flush event data" description="Owner only. Deletes event activity for good. Staff accounts, event settings, events, problem statements and the audit log are kept.">
      {preview.isError ? <Notice tone="red">{errorMessage(preview.error, "Could not load what would be deleted.")}</Notice> : !data ? <LoadingRows /> : (
        <div className="flex flex-col gap-4">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            {Object.entries(data.counts).map(([label, count]) => (
              <li key={label} className="flex justify-between gap-2 border-b border-dashed border-border py-1">
                <span className="text-muted-foreground">{label}</span><span className="tabular-nums">{count}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-end gap-3">
            <Button tone="amber" disabled={busy} onClick={() => void sendCode()}>{codeSent ? "Send a new code" : "1. Email me a code"}</Button>
            {codeSent ? <span className="pb-1.5 text-xs text-muted-foreground">Sent to {codeSent.to}; expires {dateTime(codeSent.expires)}.</span> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="2. Code from the email">
              <TextInput inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={!codeSent}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="123456" />
            </Field>
            <Field label="3. Your password">
              <TextInput type="password" autoComplete="current-password" value={password} disabled={!codeSent} onChange={(event) => setPassword(event.target.value)} />
            </Field>
            <Field label={`4. Type ${data.phrase}`} error={phrase && !data.phrase.startsWith(phrase) ? "Doesn't match yet" : undefined}>
              <TextInput value={phrase} disabled={!codeSent} autoComplete="off" spellCheck={false}
                onPaste={(event) => { event.preventDefault(); toast.error("Type the phrase by hand.") }}
                onDrop={(event) => event.preventDefault()}
                onChange={(event) => setPhrase(event.target.value)} placeholder={data.phrase} />
            </Field>
          </div>
          <div>
            <ConfirmButton confirmLabel="Yes, delete everything now" disabled={!ready || busy} onConfirm={() => void flush()}>Flush all event data</ConfirmButton>
          </div>
        </div>
      )}
    </Panel>
  )
}
