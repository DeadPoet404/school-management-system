"use client"

import * as React from "react"
import type { ComponentType } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronRight } from "lucide-react"
import {
  operationsSectionsForRole,
  type OperationsModule,
} from "@/lib/operations-manifest"

interface OperationsMobileHomeProps {
  role: string | null | undefined
}

/**
 * Mobile (below lg) rendition of the Operations workspace.
 *
 * Desktop shows a persistent sub-sidebar + the active module side by side.
 * That does not fit a phone, so mobile replaces it with a module "home"
 * (one large touch row per module, grouped by section). Tapping a module:
 * - `route` modules navigate exactly as they do on desktop
 * - `view` modules open full-width with a back bar to return to the grid
 */
export function OperationsMobileHome({ role }: OperationsMobileHomeProps) {
  const router = useRouter()
  const sections = React.useMemo(
    () => operationsSectionsForRole(role),
    [role]
  )
  const [activeModule, setActiveModule] =
    React.useState<OperationsModule | null>(null)

  const handleSelect = React.useCallback(
    (module: OperationsModule) => {
      if (module.action.type === "route") {
        router.push(module.action.path)
        return
      }
      setActiveModule(module)
    },
    [router]
  )

  // ── Active view-module workspace with a back bar ──
  if (activeModule && activeModule.action.type === "view") {
    const Workspace: ComponentType = activeModule.action.component

    return (
      <div className="flex h-full w-full flex-col bg-background">
        <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-zinc-100 bg-background/95 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-950/95 backdrop-blur">
          <button
            type="button"
            onClick={() => setActiveModule(null)}
            aria-label="Back to operations modules"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 active:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold tracking-[0.18em] text-zinc-400 uppercase dark:text-zinc-500">
              Operations
            </p>
            <p className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
              {activeModule.title}
            </p>
          </div>
        </header>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Workspace />
        </div>
      </div>
    )
  }

  // ── Module home (default mobile state) ──
  return (
    <div className="custom-scrollbar h-full w-full overflow-y-auto overscroll-contain bg-background">
      <div className="px-4 pt-4 pb-8">
        <h2 className="text-2xl font-medium tracking-tight text-foreground">
          Operations
        </h2>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Choose a workspace to open it.
        </p>

        {sections.length === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              No operations are available for your role.
            </p>
            <p className="text-xs text-zinc-400">
              Ask an administrator if you expected to see tools here.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-7">
            {sections.map((section) => {
              const SectionIcon = section.icon
              return (
                <section key={section.title}>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <SectionIcon className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                    <h3 className="text-sm font-bold tracking-wide text-zinc-700 dark:text-zinc-300">
                      {section.title}
                    </h3>
                  </div>

                  <ul className="overflow-hidden rounded-xl border border-zinc-100 bg-background dark:border-zinc-800">
                    {section.modules.map((module) => (
                      <li
                        key={module.id}
                        className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
                      >
                        <button
                          type="button"
                          onClick={() => handleSelect(module)}
                          className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-900/40 dark:active:bg-zinc-900"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
                              {module.title}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                              {section.group}
                            </span>
                          </span>
                          <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300 dark:text-zinc-600" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
