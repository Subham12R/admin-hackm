"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useState, type FormEvent } from "react"

import { RichButton } from "@/components/rich-button"

function InviteForm() {
  const token = useSearchParams().get("token") ?? ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [state, setState] = useState<{ pending: boolean; error: string; done: boolean }>({ pending: false, error: "", done: false })

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password.length < 8 || password !== confirm) return
    setState({ pending: true, error: "", done: false })
    try {
      const response = await fetch("/api/auth/invite-accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await response.json().catch(() => null)
      setState(response.ok ? { pending: false, error: "", done: true } : { pending: false, error: data?.error ?? "The invite could not be accepted.", done: false })
    } catch {
      setState({ pending: false, error: "The admin service could not be reached.", done: false })
    }
  }

  if (!token) return <p className="text-sm">This invite link is incomplete. Open the link from your invite email.</p>
  if (state.done) {
    return (
      <div className="space-y-3">
        <p className="text-sm">Your account is ready.</p>
        <RichButton asChild color="green" size="sm" className="font-pixel-square tracking-tighter"><Link href="/login">Sign in</Link></RichButton>
      </div>
    )
  }
  return (
    <form method="post" onSubmit={submit} className="space-y-3">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Choose a password (at least 8 characters)
        <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-9 rounded-md border border-zinc-200 px-2 text-sm text-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Repeat the password
        <input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="h-9 rounded-md border border-zinc-200 px-2 text-sm text-zinc-900" />
      </label>
      {confirm && confirm !== password ? <p className="text-xs text-red-600">Passwords do not match.</p> : null}
      {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
      <RichButton type="submit" color="green" size="sm" disabled={state.pending || password.length < 8 || password !== confirm} className="font-pixel-square tracking-tighter">
        {state.pending ? "Saving…" : "Accept invite"}
      </RichButton>
    </form>
  )
}

export default function InvitePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 p-4 font-pixel-square">
      <section className="w-full max-w-sm rounded-2xl bg-zinc-100 p-1">
        <div className="space-y-4 rounded-xl bg-white p-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Join HackMatrix Admin</h1>
            <p className="text-sm tracking-tighter text-muted-foreground">Set a password to accept your staff invite.</p>
          </div>
          <Suspense fallback={null}><InviteForm /></Suspense>
        </div>
      </section>
    </main>
  )
}
