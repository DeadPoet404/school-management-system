"use client"

import * as React from "react"
import { TransportDashboard } from "@/components/transport-dashboard"
import { TransportDriverDashboard } from "@/components/transport-driver-dashboard"

type UserInfo = { role?: string } | null

function useUserRole(): string | null {
  const [role, setRole] = React.useState<string | null>(null)
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" })
        if (!res.ok) return
        const payload = await res.json()
        const userRole = payload?.data?.role ?? payload?.role ?? null
        if (!cancelled) setRole(userRole ? String(userRole).toUpperCase() : null)
      } catch {
        // fallback: try localStorage role if available
        try {
          const raw = localStorage.getItem("sms.auth.user")
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed?.role && !cancelled) setRole(String(parsed.role).toUpperCase())
          }
        } catch {}
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])
  return role
}

export default function TransportPage() {
  const role = useUserRole()
  // While role is loading, show nothing to avoid flicker. Driver detection is explicit.
  if (role === "DRIVER") {
    return <TransportDriverDashboard />
  }
  // ADMIN, STAFF, and unknown (fallback) get full control room. Backend still enforces RBAC.
  return <TransportDashboard />
}
