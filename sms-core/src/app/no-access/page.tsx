"use client"

import { useAuth } from "@/lib/auth-context"
import { AccessDeniedPanel } from "@/components/access-denied-panel"

export default function NoAccessPage() {
  const { user, logout } = useAuth()
  return (
    <div className="h-screen w-full bg-background">
      <AccessDeniedPanel role={user?.role ?? null} onLogout={logout} />
    </div>
  )
}
