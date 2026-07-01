"use client"

import "timepicker-ui/main.css"
import * as React from "react"
import { useRouter } from "next/navigation"

// Component Layout Architecture
import { OperationsSidebar } from "@/components/operations-sidebar"
import { TimetableStructureSetup} from "@/components/timetable-structure-setup"
import { FeeStructureInvoiceConfig } from "@/components/fee-structure-invoice-config"
import { PaymentInflowCollectionLog } from "@/components/payment-inflow-collection-log"
import { PayrollLedgersView } from "@/components/payroll-ledgers-view"
import { StaffContractsGovernance} from "@/components/staff-contracts-governance"

// Explicit Type System contracts matching upcoming API models
type NavigationRoute = {
  type: "route"
  path: string
}

type WorkspaceView = {
  type: "view"
  component: React.ComponentType
}

type OperationRegistryItem = {
  id: string
  title: string
  action: NavigationRoute | WorkspaceView
}

// 1. DATA MANIFEST: Centralized router map. 
// When backing APIs go live, this array mirrors your permissions or dynamic route definitions.
const OPERATIONS_MANIFEST: OperationRegistryItem[] = [
  {
  id: "class-gen",
  title: "Class Timetable Generation",
  action: { type: "view", component: TimetableStructureSetup },
},
  {
  id: "fee-structure",
  title: "Fee Structure Generation",
  action: { type: "view", component: FeeStructureInvoiceConfig },
},
  {
  id: "payment-collection",
  title: "Inflows & Collections Logging",
  action: { type: "view", component: PaymentInflowCollectionLog },
},
  {
    id: "payroll-ledgers",
    title: "Payroll Ledgers Configuration",
    action: { type: "view", component: PayrollLedgersView },
  },
  {
    id: "staff-registry",
    title: "Staff Registry & Contracts",
    action: { type: "view", component: StaffContractsGovernance },
  },
  {
    id: "hr-leave",
    title: "Staff Leave Management",
    action: { type: "route", path: "/staff/leave?from=operations" },
  },
  {
    id: "enrollment-workflow",
    title: "Student Registration Funnel",
    action: { type: "route", path: "/students/add_student?from=operations" },
  },
  {
    id: "student-leave",
    title: "Student Leave Processing",
    action: { type: "route", path: "/students/leave?from=operations" },
  },
]

function PlaceholderView({ title }: { title: string }) {
  return (
    <main className="flex-1 h-full flex flex-col items-center justify-center bg-transparent px-8 py-6 text-center">
      <h1 className="text-sm font-medium text-zinc-400 dark:text-zinc-500 tracking-tight">
        {title} Workspace
      </h1>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
        This sub-operational module interface is configured and ready for localized backend schema mounting.
      </p>
    </main>
  )
}

export default function OperationsPage() {
  const router = useRouter()
  
  // Set default core identifiers using verified registry tokens
  const [activeSubItem, setActiveSubItem] = React.useState<string>("class-gen")

  // Look up current active structure data instantly from manifest map
  const activeConfig = React.useMemo(() => {
    return OPERATIONS_MANIFEST.find((item) => item.id === activeSubItem)
  }, [activeSubItem])

  // Context-aware execution engine
  const handleSelect = React.useCallback((id: string, fallbackTitle: string) => {
    const targetConfig = OPERATIONS_MANIFEST.find((item) => item.id === id)

    // Handle missing manifests safely without throwing runtime breaks
    if (!targetConfig) {
      setActiveSubItem(id)
      return
    }

    if (targetConfig.action.type === "route") {
      router.push(targetConfig.action.path)
    } else {
      setActiveSubItem(id)
    }
  }, [router])

  // Dynamic JSX Resolution Engine
  const TargetWorkspaceComponent = React.useMemo(() => {
    if (activeConfig && activeConfig.action.type === "view") {
      return activeConfig.action.component
    }
    return null
  }, [activeConfig])

  return (
    <div className="w-full h-full min-h-0 bg-zinc-50/40 dark:bg-zinc-950/20 flex justify-center overflow-hidden">
      <div className="flex h-full w-full max-w-6xl bg-background border-x border-zinc-100 dark:border-zinc-900 text-zinc-900 dark:text-zinc-50 overflow-hidden">
        
        <OperationsSidebar 
          activeSubItem={activeSubItem} 
          onSelect={handleSelect} 
        />

        {TargetWorkspaceComponent ? (
          <TargetWorkspaceComponent />
        ) : (
          <PlaceholderView title={activeConfig?.title || "Operational"} />
        )}

      </div>
    </div>
  )
}