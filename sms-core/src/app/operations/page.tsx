"use client"

import "timepicker-ui/main.css"
import * as React from "react"
import { useRouter } from "next/navigation"
import { OperationsSidebar } from "@/components/operations-sidebar"
import { OperationsMobileHome } from "@/components/mobile/operations-mobile-home"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  defaultOperationsModuleIdForRole,
  findOperationsModuleForRole,
} from "@/lib/operations-manifest"
import { useAuth } from "@/lib/auth-context"

export default function OperationsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const role = user?.role ?? null
  const isMobile = useIsMobile()

  const defaultId = React.useMemo(
    () => defaultOperationsModuleIdForRole(role) ?? "class-gen",
    [role]
  )

  const [activeSubItem, setActiveSubItem] = React.useState<string>(defaultId)

  // Keep the active selection valid for the current role.
  React.useEffect(() => {
    if (!findOperationsModuleForRole(role, activeSubItem)) {
      setActiveSubItem(defaultId)
    }
  }, [role, defaultId, activeSubItem])

  const activeModule = React.useMemo(
    () => findOperationsModuleForRole(role, activeSubItem),
    [role, activeSubItem]
  )

  const handleSelect = React.useCallback(
    (id: string) => {
      const targetModule = findOperationsModuleForRole(role, id)
      if (!targetModule) return
      if (targetModule.action.type === "route") {
        router.push(targetModule.action.path)
        return
      }
      setActiveSubItem(id)
    },
    [router, role]
  )

  const TargetWorkspaceComponent = React.useMemo(() => {
    const resolvedModule =
      activeModule && activeModule.action.type === "view"
        ? activeModule
        : findOperationsModuleForRole(role, defaultId)
    return resolvedModule && resolvedModule.action.type === "view"
      ? resolvedModule.action.component
      : null
  }, [activeModule, role, defaultId])

  // Mobile cannot fit the persistent sub-sidebar + workspace two-pane. Swap to
  // a module home grid with full-width workspace + back bar (see
  // OperationsMobileHome). Desktop behaviour is unchanged.
  if (isMobile) {
    return <OperationsMobileHome role={role} />
  }

  return (
    <div className="w-full h-full min-h-0 bg-zinc-50/40 dark:bg-zinc-950/20 flex justify-center overflow-hidden">
      <div className="flex h-full w-full max-w-6xl bg-background border-x border-zinc-100 dark:border-zinc-900 text-zinc-900 dark:text-zinc-50 overflow-hidden">
        <OperationsSidebar activeSubItem={activeSubItem} onSelect={handleSelect} />
        {TargetWorkspaceComponent ? <TargetWorkspaceComponent /> : null}
      </div>
    </div>
  )
}
