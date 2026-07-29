"use client"

import { defaultLandingForRole, roleHasAnyModule } from "@/lib/role-access"

export function AccessDeniedPanel({
  role,
  onLogout,
}: {
  role: string | null
  onLogout?: () => void
}) {
  const hasModules = role !== null && roleHasAnyModule(role)
  const landing = defaultLandingForRole(role)

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
