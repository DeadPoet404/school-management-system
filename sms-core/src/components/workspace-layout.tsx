"use client"

import * as React from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth-context"
import { ProtectedRoute } from "@/components/protected-route"
import { usePathname } from "next/navigation"
import { isPathAllowedForRole } from "@/lib/role-access"
import { AccessDeniedPanel } from "@/components/access-denied-panel"

export function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const role = user?.role ?? null
  const pathAllowed = role === null || isPathAllowedForRole(role, pathname)
  const initials = user?.email?.charAt(0).toUpperCase() || "??"

  return (
    <ProtectedRoute>
      <TooltipProvider delayDuration={0}>
        <SidebarProvider defaultOpen={false} className="h-screen overflow-hidden">
          <AppSidebar user={user} initials={initials} onLogout={logout} />

          <SidebarInset className="bg-background transition-all duration-200 ease-linear flex-1 min-h-0 flex flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <span className="text-sm font-medium tracking-tight text-muted-foreground">
                  Platform Workspace
                </span>
              </div>
            </header>

            <div className="relative flex-1 flex flex-col min-h-0">
              <main className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col">
                {pathAllowed ? children : <AccessDeniedPanel role={role} onLogout={logout} />}
              </main>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </ProtectedRoute>
  )
}
