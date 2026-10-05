"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { motion, type Variants } from "motion/react"
import { ArrowLeft } from "lucide-react"

import { RichButton } from "@/components/rich-button"

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
}

export default function Auth09() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setPending(false)
        setError(typeof data?.error === "string" ? data.error : "Invalid email or password.")
        return
      }
      router.push("/dashboard")
    } catch {
      setPending(false)
      setError("The admin service could not be reached. Try again.")
    }
  }

  if (pending && !error) {
    return (
      <div className="min-h-dvh animate-pulse bg-zinc-50 p-6" aria-busy="true" aria-label="Opening dashboard">
        <div className="h-8 w-48 rounded-md bg-zinc-200" />
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="h-28 rounded-xl bg-zinc-200" />
          <div className="h-28 rounded-xl bg-zinc-200" />
          <div className="h-28 rounded-xl bg-zinc-200" />
        </div>
        <div className="mt-4 h-72 rounded-xl bg-zinc-200" />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-white font-pixel-square text-neutral-950 antialiased lg:flex-row">
      <div className="relative flex min-h-64 w-full flex-col justify-between overflow-hidden p-8 md:p-12 lg:min-h-dvh lg:w-1/2">
        <img
          src="https://assets.watermelon.sh/auth-9.avif"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="relative z-10 flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight text-white">HackMatrix</span>
          <a href="https://hackmatrix.codes" className="flex items-center gap-2 text-sm font-medium text-white/90 hover:text-white">
            <ArrowLeft className="size-4" />
            Back to website
          </a>
        </div>
        <div className="relative z-10 mt-12 lg:mt-0">
          <h1 className="mb-4 max-w-xl text-4xl font-medium leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Run the event
            <br />
            from one desk.
          </h1>
          <p className="max-w-md text-base leading-relaxed text-white/90 sm:text-lg">
            Registrations, teams, and payments for invited HackMatrix operators.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col items-center justify-center p-6 sm:p-12 lg:w-1/2">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-md">
          <motion.div variants={itemVariants} className="mb-6">
            <h2 className="mb-2 text-3xl font-medium tracking-tight">Sign in</h2>
            <p className="text-[15px] text-neutral-500">Use the admin account created for this event.</p>
          </motion.div>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <input id="email" type="email" autoComplete="email" required placeholder="you@hackmatrix.codes" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
            </motion.div>
            <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <input id="password" type="password" autoComplete="current-password" required placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
            </motion.div>
            {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
            <motion.div variants={itemVariants}>
              <RichButton type="submit" disabled={pending} aria-busy={pending} color="green" className="w-full font-pixel-square text-sm tracking-tighter normal-case">
                {pending ? <span className="size-3 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
                {pending ? "Signing in" : "Sign in"}
              </RichButton>
            </motion.div>
          </form>
        </motion.div>
      </div>
    </div>
  )
}
