"use client"

import "timepicker-ui/main.css"
import * as React from "react"
import { useRouter } from "next/navigation"
import { OperationsSidebar } from "@/components/operations-sidebar"
import { DEFAULT_OPERATIONS_MODULE_ID, findOperationsModule } from "@/lib/operations-manifest"

export default function OperationsPage() {
  const router = useRouter()

  // SMS-003: the shared Operations manifest is the single source of truth.
  // Only modules listed there are reachable, and every one resolves to a real
  // workspace view or route — placeholder dead ends are no longer renderable.
  const [activeSubItem, setActiveSubItem] = React.useState<string>(DEFAULT_OPERATIONS_MODULE_ID)

  const activeModule = React.useMemo(() => findOperationsModule(activeSubItem), [activeSubItem])

  const handleSelect = React.useCallback((id: string) => {
    const targetModule = findOperationsModule(id)
    // Unmapped ids are ignored: navigation may only target manifest entries.
    if (!targetModule) return
    if (targetModule.action.type === "route") {
      router.push(targetModule.action.path)
      return
    }
    setActiveSubItem(id)
  }, [router])

  // Defensive fallback: any unmapped or route-typed selection resolves to the
  // default workspace view instead of a placeholder.
  const TargetWorkspaceComponent = React.useMemo(() => {
    const resolvedModule =
      activeModule && activeModule.action.type === "view"
        ? activeModule
        : findOperationsModule(DEFAULT_OPERATIONS_MODULE_ID)
    return resolvedModule && resolvedModule.action.type === "view" ? resolvedModule.action.component : null
  }, [activeModule])

  return (
    <div className="w-full h-full min-h-0 bg-zinc-50/40 dark:bg-zinc-950/20 flex justify-center overflow-hidden">
      <div className="flex h-full w-full max-w-6xl bg-background border-x border-zinc-100 dark:border-zinc-900 text-zinc-900 dark:text-zinc-50 overflow-hidden">
        <OperationsSidebar activeSubItem={activeSubItem} onSelect={handleSelect} />
        {TargetWorkspaceComponent ? <TargetWorkspaceComponent /> : null}
      </div>
    </div>
  )
}
