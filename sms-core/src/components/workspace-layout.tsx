"use client"

import * as React from "react"
import { Suspense } from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { ViewToggle } from "@/components/view-toggle"
import { useAuth } from "@/lib/auth-context"
import { ProtectedRoute } from "@/components/protected-route"

export function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
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
              <div className="absolute top-4 right-6 z-40 hidden md:block">
                <Suspense fallback={<div className="h-9 w-[220px] bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-lg" />}>
                  <ViewToggle />
                </Suspense>
              </div>

              <main className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col">
                {children}
              </main>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </ProtectedRoute>
  )
}
