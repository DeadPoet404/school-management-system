"use client"

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth-context"
import { ProtectedRoute } from "@/components/protected-route"

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const initials = user?.email?.charAt(0).toUpperCase() || "??"

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar user={user} initials={initials} onLogout={logout} />

        <SidebarInset className="bg-background transition-all duration-200 ease-linear">
          <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <span className="text-sm font-medium tracking-tight text-muted-foreground">
                Platform Workspace
              </span>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-1">
            {children}
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
