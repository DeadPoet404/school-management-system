"use client"

import { useState, FormEvent, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { ApiClientError } from "@/lib/fetch-with-auth"
import { landingPathForRole } from "@/lib/role-access"
import { getSetupStatus } from "@/lib/api/setup"
import Link from "next/link"

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [requiresSetup, setRequiresSetup] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const status = await getSetupStatus()
        if (cancelled) return
        setRequiresSetup(status.requiresSetup)
        // No admin yet → force wizard (bootstrap is public)
        if (status.requiresSetup && !status.hasAdmin) {
          router.replace("/setup")
        }
      } catch {
        if (!cancelled) setRequiresSetup(false)
      }
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const loggedInUser = await login(email, password)
      try {
        const status = await getSetupStatus()
        if (status.requiresSetup && loggedInUser.role === "ADMIN") {
          router.push("/setup")
          return
        }
      } catch {
        // fall through
      }
      const from = new URLSearchParams(window.location.search).get("from")
      router.push(landingPathForRole(loggedInUser.role, from))
    } catch (err) {
      if (err instanceof ApiClientError || err instanceof Error) {
        setError(err.message)
      } else {
        setError("An unexpected error occurred.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold">
            Ω
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access the platform
          </p>
        </div>

        {requiresSetup && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            First-start setup is not finished.{" "}
            <Link href="/setup" className="font-medium text-primary underline-offset-4 hover:underline">
              Continue setup
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@school.com"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  )
}
