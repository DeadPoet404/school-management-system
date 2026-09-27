"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BusFront, LoaderCircle, ShieldCheck } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { ApiClientError } from "@/lib/fetch-with-auth"
import { TransportDriverDashboard } from "@/components/transport-driver-dashboard"
import { cn } from "@/lib/utils"

/**
 * Jocomfy Bus — the driver app entry point.
 * Installed to the tablet home screen via the web manifest; opens full-screen
 * (standalone) with no browser UI. Drivers log in once and stay logged in
 * (7-day session refresh), so after that it is: open app → scan.
 */
export default function BusAppPage() {
  const { user, isLoading, login } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50">
        <BusFront className="h-14 w-14 text-[#10254a]" />
        <LoaderCircle className="h-6 w-6 animate-spin text-stone-400" />
        <p className="text-sm font-medium text-stone-500">Jocomfy Bus</p>
      </div>
    )
  }

  if (!user) return <DriverLogin onLogin={login} />

  if (String(user.role).toUpperCase() === "DRIVER") {
    return (
      <div className="min-h-screen bg-stone-50">
        <TransportDriverDashboard />
      </div>
    )
  }

  return <NonDriverNotice />
}

function DriverLogin({ onLogin }: { onLogin: (email: string, password: string) => Promise<unknown> }) {
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      await onLogin(email, password)
      // AuthContext state update re-renders this page to the driver dashboard.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#10254a] p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <BusFront className="h-10 w-10 text-[#10254a]" />
          <h1 className="text-xl font-semibold text-stone-950">Jocomfy Bus</h1>
          <p className="text-sm text-stone-500">Sign in with your driver account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500" htmlFor="bus-email">
              Email
            </label>
            <input
              id="bus-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-base outline-none focus:border-[#10254a] focus:ring-2 focus:ring-[#10254a]/20"
              placeholder="driver@jocomfy.edu.gh"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500" htmlFor="bus-password">
              Password
            </label>
            <input
              id="bus-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-base outline-none focus:border-[#10254a] focus:ring-2 focus:ring-[#10254a]/20"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl bg-[#10254a] px-4 py-3.5 text-base font-semibold text-white transition",
              busy && "opacity-60"
            )}
          >
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-center text-xs text-stone-400">
            You only need to sign in once — this tablet stays signed in.
          </p>
        </form>
      </div>
    </div>
  )
}

function NonDriverNotice() {
  const router = useRouter()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 p-6 text-center">
      <ShieldCheck className="h-10 w-10 text-stone-400" />
      <h1 className="text-lg font-semibold text-stone-900">This is the driver app</h1>
      <p className="max-w-sm text-sm text-stone-500">
        Your account is not a driver account, so the scanning screen is not available.
      </p>
      <button
        onClick={() => router.push("/dashboard/transport")}
        className="rounded-xl bg-[#10254a] px-5 py-3 text-sm font-semibold text-white"
      >
        Open transport control room
      </button>
    </div>
  )
}
