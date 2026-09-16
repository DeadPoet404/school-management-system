"use client"

import { useState, FormEvent, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { ApiClientError } from "@/lib/fetch-with-auth"
import { landingPathForRole } from "@/lib/role-access"
import { getSetupStatus } from "@/lib/api/setup"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [requiresSetup, setRequiresSetup] = useState<boolean | null>(null)
  // After a successful login the page fades out briefly before navigating,
  // so the dashboard entrance reads as its own moment.
  const [leaving, setLeaving] = useState(false)

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
      const from = new URLSearchParams(window.location.search).get("from")
      let target = landingPathForRole(loggedInUser.role, from)
      try {
        const status = await getSetupStatus()
        if (status.requiresSetup && loggedInUser.role === "ADMIN") {
          target = "/setup"
        }
      } catch {
        // fall through
      }
      // Let the fade-out finish before the route change.
      setLeaving(true)
      window.setTimeout(() => router.push(target), 280)
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
    <div
      className={cn(
        "relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4",
        leaving && "pointer-events-none animate-fade-out-soft"
      )}
    >
      {/* Soft ambient glow at the top — quiet depth, no decoration. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[38rem] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-stone-200/70 bg-background p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-20px_rgba(0,0,0,0.16)] animate-fade-rise dark:border-zinc-800/70">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold shadow-lg shadow-primary/20 animate-scale-in">
              Ω
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight animate-rise-in [animation-delay:60ms]">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-muted-foreground animate-rise-in [animation-delay:100ms]">
              Sign in to your school workspace.
            </p>
          </div>

          {requiresSetup && (
            <div className="mt-5 rounded-lg border border-primary/20 bg-primary/[0.04] p-3 text-sm animate-rise-in [animation-delay:140ms] dark:border-primary/30">
              First-start setup is not finished.{" "}
              <Link href="/setup" className="font-medium underline-offset-4 hover:underline">
                Continue setup
              </Link>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive animate-error-in">
                {error}
              </div>
            )}

            <div className="space-y-2 animate-rise-in [animation-delay:180ms]">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@school.com"
                autoComplete="email"
                className="h-10"
              />
            </div>

            <div className="space-y-2 animate-rise-in [animation-delay:220ms]">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
                className="h-10"
              />
            </div>

            <div className="pt-1 animate-rise-in [animation-delay:260ms]">
              <Button type="submit" loading={loading} className="h-10 w-full">
                Sign in
              </Button>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/70 animate-fade-in-soft [animation-delay:420ms]">
          Jocomfy · School Management System
        </p>
      </div>
    </div>
  )
}
