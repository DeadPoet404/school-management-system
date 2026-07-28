"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { operationsSectionsForRole } from "@/lib/operations-manifest"
import { useAuth } from "@/lib/auth-context"

interface OperationsSidebarProps {
  activeSubItem: string
  onSelect: (id: string, title: string) => void
}

export function OperationsSidebar({ activeSubItem, onSelect }: OperationsSidebarProps) {
  const { user } = useAuth()
  const sections = React.useMemo(() => operationsSectionsForRole(user?.role ?? null), [user?.role])

  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({})

  // Default every section open once the role specific sections are known.
  React.useEffect(() => {
    setOpenSections(Object.fromEntries(sections.map((section) => [section.title, true])))
  }, [sections])

  const prevActiveItemRef = React.useRef<string>(activeSubItem)

  React.useEffect(() => {
    if (!activeSubItem) return
    if (prevActiveItemRef.current !== activeSubItem) {
      const targetSection = sections.find((section) =>
        section.modules.some((module) => module.id === activeSubItem)
      )
      if (targetSection) {
        setOpenSections((prev) => ({
          ...prev,
          [targetSection.title]: true
        }))
      }
      prevActiveItemRef.current = activeSubItem
    }
  }, [activeSubItem, sections])

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionTitle]: !prev[sectionTitle] }))
  }

  return (
    <aside className="w-64 h-full flex flex-col bg-transparent select-none shrink-0">
      <ScrollArea className="flex-1 w-full bg-transparent">
        <nav className="mt-32 px-3 pb-8 space-y-4">
          {sections.map((section) => {
            const Icon = section.icon
            const isOpen = !!openSections[section.title]
            const containsActiveChild = section.modules.some((module) => module.id === activeSubItem)

            return (
              <div key={section.title} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-semibold text-stone-600 hover:text-stone-950 hover:bg-stone-50/70 transition-all group",
                    isOpen && "text-stone-950 bg-stone-50/50",
                    containsActiveChild && !isOpen && "border-r-2 border-stone-900 rounded-r-none text-stone-950 bg-stone-50/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn(
                      "h-3.5 w-3.5 stroke-[2] text-stone-400 group-hover:text-stone-600 transition-colors",
                      containsActiveChild && "text-stone-900 stroke-[2.5]"
                    )} />
                    <span className="tracking-tight text-left">{section.title}</span>
                  </div>
                  <ChevronRight className={cn("h-3 w-3 text-stone-400 transition-transform duration-200", isOpen && "transform rotate-90 text-stone-600")} />
                </button>
                {isOpen && (
                  <div className="pl-3.5 ml-2 space-y-4 pt-1 pb-1.5 border-l border-stone-100">
                    <div className="space-y-1">
                      <span className="block px-2 text-[10px] font-bold tracking-wider text-stone-400 uppercase">
                        {section.group}
                      </span>
                      <div className="space-y-0.5">
                        {section.modules.map((module) => {
                          const isCurrentActive = activeSubItem === module.id
                          const itemClasses = cn(
                            "w-full block text-left px-2 py-1 rounded text-[11px] font-medium text-stone-500 hover:text-stone-950 hover:bg-stone-50/50 transition-colors tracking-tight truncate",
                            isCurrentActive && "text-stone-950 font-semibold bg-stone-50"
                          )
                          const href = module.action.type === "route" ? module.action.path : undefined

                          if (href) {
                            return (
                              <Link
                                key={module.id}
                                href={href}
                                onClick={() => onSelect(module.id, module.title)}
                                className={itemClasses}
                              >
                                {module.title}
                              </Link>
                            )
                          }

                          return (
                            <button
                              key={module.id}
                              type="button"
                              onClick={() => onSelect(module.id, module.title)}
                              className={itemClasses}
                            >
                              {module.title}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </ScrollArea>
    </aside>
  )
}
