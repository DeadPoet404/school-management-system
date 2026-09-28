"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSetupStatus } from "@/lib/api/setup"
import { fetchWithAuth } from "@/lib/fetch-with-auth"
import { landingPathForRole } from "@/lib/role-access"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function route() {
      // Already signed in? Send the person straight to their own app —
      // a driver lands on /bus, which is their entire interface.
      try {
        const meRes = await fetchWithAuth("/auth/me")
        if (!meRes.ok) {
          // fall through to status/login
        } else {
          const json = await meRes.json()
          const user = json?.data?.user
          if (user?.role && !cancelled) {
            router.replace(landingPathForRole(user.role))
            return
          }
        }
      } catch {
        // no session — fall through
      }
      if (cancelled) return

      try {
        const status = await getSetupStatus()
        if (cancelled) return
        router.replace(status.requiresSetup ? "/setup" : "/login")
      } catch {
        if (!cancelled) router.replace("/login")
      }
    }

    void route()
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-sm text-muted-foreground">
      Checking system status…
    </div>
  )
}
