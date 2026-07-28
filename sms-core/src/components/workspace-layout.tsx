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
import { usePathname } from "next/navigation"
import { isPathAllowedForRole, defaultLandingForRole, roleHasAnyModule } from "@/lib/role-access"

function AccessDeniedPanel({
  role,
  onLogout,
  hasModules,
  landing,
}: {
  role: string | null
  onLogout?: () => void
  hasModules: boolean
  landing: string
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-sm font-bold tracking-widest text-muted-foreground">
          403
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          {hasModules ? "Access denied for this area" : "No portal access for your account"}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {hasModules
            ? "Your role is not permitted to open this page. Use the menu or the button below to return to your workspace."
            : "Your account role has no workspace modules in this version of the platform. Please contact your school administrator or sign out."}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          {hasModules && (
            <a
              href={landing}
              className="flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to my workspace
            </a>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted"
          >
            Sign out
          </button>
        </div>
        {role && (
          <p className="pt-2 text-xs text-muted-foreground">
            Signed in as <span className="font-medium">{role}</span>
          </p>
        )}
      </div>
    </div>
  )
}

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
              <div className="absolute top-4 right-6 z-40 hidden md:block">
                <Suspense fallback={<div className="h-9 w-[220px] bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-lg" />}>
                  <ViewToggle />
                </Suspense>
              </div>

              <main className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col">
                {pathAllowed ? children : <AccessDeniedPanel role={role} onLogout={logout} hasModules={role !== null && roleHasAnyModule(role)} landing={defaultLandingForRole(role)} />}
              </main>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </ProtectedRoute>
  )
}
