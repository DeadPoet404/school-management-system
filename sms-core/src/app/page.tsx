"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSetupStatus } from "@/lib/api/setup"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function route() {
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
