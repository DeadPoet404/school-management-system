"use client"

import * as React from "react"
import Link from "next/link"
import { 
  ChevronRight, 
  School, 
  Users, 
  GraduationCap, 
  FileSpreadsheet, 
  Shield, 
  Wallet, 
  Bus 
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

interface LeafItem {
  title: string
  id: string
  href?: string // Optional explicit router link path for workspace redirection
}

interface NavItem {
  title: string
  id: string
  items: LeafItem[]
}

interface NavSection {
  title: string
  icon: React.ComponentType<{ className?: string }>
  items: NavItem[]
}

const operationalNavigation: NavSection[] = [
  {
    title: "System Governance",
    icon: Shield,
    items: [
      {
        title: "Security & Control",
        id: "sys-security",
        items: [
          { title: "Access & Permissions (RBAC)", id: "access-permissions" },
          { title: "System Configuration", id: "global-setup" },
          { title: "Audit Trails & Backups", id: "audit-maintenance" }
        ]
      }
    ]
  },
  {
    title: "Academic Operations",
    icon: School,
    items: [
      {
        title: "Infrastructure",
        id: "academic-infra",
        items: [
          { title: "Timetable & Scheduling", id: "class-gen" }, 
          { title: "Curriculum & Course Maps", id: "curriculum-manager" }
        ]
      }
    ]
  },
  {
    title: "Finance & Accounts",
    icon: Wallet,
    items: [
      {
        title: "Bursar Control",
        id: "bursar-control",
        items: [
          { title: "Fee Structures & Invoicing", id: "fee-structure" },
          { title: "Collections & Receipts", id: "payment-collection" },
          { title: "Payroll & Ledgers", id: "payroll-ledgers" }
        ]
      }
    ]
  },
  {
    title: "HR & Staff Operations",
    icon: Users,
    items: [
      {
        title: "Workforce Management",
        id: "workforce-mgmt",
        items: [
          { title: "Staff Contracts & Tenures", id: "staff-registry" },
          { title: "Leave & HR Workflows", id: "hr-leave" }
        ]
      }
    ]
  },
  {
    title: "Student Lifecycle Hub",
    icon: GraduationCap,
    items: [
      {
        title: "Student Management",
        id: "student-mgmt",
        items: [
          { 
            title: "Enrollment workflow", 
            id: "enrollment-workflow", 
            href: "/students/add?from=operations" // Direct routing pipeline link parameter
          },
          { title: "Leave & Exit Workflows", id: "student-leave" }
        ]
      }
    ]
  },
  {
    title: "Assessments & Exams",
    icon: FileSpreadsheet,
    items: [
      {
        title: "Academic Testing",
        id: "academic-testing",
        items: [
          { title: "Exam Administration", id: "exam-admin" },
          { title: "Grading & Report Cards", id: "grading-frameworks" }
        ]
      }
    ]
  },
  {
    title: "Back-Office Logistics",
    icon: Bus,
    items: [
      {
        title: "Operations & Assets",
        id: "ops-assets",
        items: [
          { title: "Fleet & Transport Routes", id: "fleet-transport" },
          { title: "Inventory & Procurement", id: "inventory-assets" },
          { title: "Auxiliary & Emergencies", id: "auxiliary-services" }
        ]
      }
    ]
  }
]

interface OperationsSidebarProps {
  activeSubItem: string
  onSelect: (id: string, title: string) => void
}

export function OperationsSidebar({ activeSubItem, onSelect }: OperationsSidebarProps) {
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    "Academic Operations": true,
    "Finance & Accounts": true,
    "HR & Staff Operations": true,
    "Student Lifecycle Hub": true
  })

  const prevActiveItemRef = React.useRef<string>(activeSubItem)

  React.useEffect(() => {
    if (!activeSubItem) return

    if (prevActiveItemRef.current !== activeSubItem) {
      const targetSection = operationalNavigation.find((section) =>
        section.items.some((subCategory) =>
          subCategory.items.some((item) => item.id === activeSubItem)
        )
      )

      if (targetSection) {
        setOpenSections((prev) => ({
          ...prev,
          [targetSection.title]: true
        }))
      }
      prevActiveItemRef.current = activeSubItem
    }
  }, [activeSubItem])

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionTitle]: !prev[sectionTitle] }))
  }

  return (
    <aside className="w-64 h-full flex flex-col bg-transparent select-none shrink-0">
      <ScrollArea className="flex-1 w-full bg-transparent">
        <nav className="mt-32 px-3 pb-8 space-y-4">
          {operationalNavigation.map((section) => {
            const Icon = section.icon
            const isOpen = !!openSections[section.title]
            const containsActiveChild = section.items.some((subCategory) =>
              subCategory.items.some((item) => item.id === activeSubItem)
            )

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
                    {section.items.map((subCategory) => (
                      <div key={subCategory.id} className="space-y-1">
                        <span className="block px-2 text-[10px] font-bold tracking-wider text-stone-400 uppercase">
                          {subCategory.title}
                        </span>
                        <div className="space-y-0.5">
                          {subCategory.items.map((item) => {
                            const isCurrentActive = activeSubItem === item.id
                            const itemClasses = cn(
                              "w-full block text-left px-2 py-1 rounded text-[11px] font-medium text-stone-500 hover:text-stone-950 hover:bg-stone-50/50 transition-colors tracking-tight truncate",
                              isCurrentActive && "text-stone-950 font-semibold bg-stone-50"
                            )

                            // Render explicit client-side link element if href schema property exists
                            if (item.href) {
                              return (
                                <Link
                                  key={item.id}
                                  href={item.href}
                                  onClick={() => onSelect(item.id, item.title)}
                                  className={itemClasses}
                                >
                                  {item.title}
                                </Link>
                              )
                            }

                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => onSelect(item.id, item.title)}
                                className={itemClasses}
                              >
                                {item.title}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
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