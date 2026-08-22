"use client"

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/lib/auth-context"
import { ProtectedRoute } from "@/components/protected-route"
import { usePathname } from "next/navigation"
import { isPathAllowedForRole } from "@/lib/role-access"
import { AccessDeniedPanel } from "@/components/access-denied-panel"

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const initials = user?.email?.charAt(0).toUpperCase() || "??"
  const pathname = usePathname()
  const role = user?.role ?? null
  const pathAllowed = role === null || isPathAllowedForRole(role, pathname)

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar user={user} initials={initials} onLogout={logout} />

        <SidebarInset className="bg-background transition-all duration-200 ease-linear">
          <header className="flex h-12 shrink-0 items-center px-4">
            <SidebarTrigger className="-ml-1" />
          </header>

          <main className="flex-1 overflow-y-auto px-4 pb-6">
            {pathAllowed ? children : <AccessDeniedPanel role={role} onLogout={logout} />}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <DashboardShell>{children}</DashboardShell>
    </ProtectedRoute>
  )
}
