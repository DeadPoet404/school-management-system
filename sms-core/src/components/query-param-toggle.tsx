"use client"

import * as React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export interface QueryParamToggleProps {
  /** The target URL search parameter key to track and mutate. @default "view" */
  paramKey?: string
  /** The parameter value corresponding to the "checked" state. @default "table" */
  activeValue?: string
  /** The parameter value corresponding to the "unchecked" state. @default "dashboard" */
  inactiveValue?: string
  /** Text label displayed when the parameter matches the active value. @default "Table View" */
  activeLabel?: string
  /** Text label displayed when the parameter matches the inactive value. @default "Dashboard View" */
  inactiveLabel?: string
  /** Additional component configuration wrapper classes. */
  className?: string
}

function QueryParamToggleInner({
  paramKey = "view",
  activeValue = "table",
  inactiveValue = "dashboard",
  activeLabel = "Table View",
  inactiveLabel = "Dashboard View",
  className,
}: QueryParamToggleProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Read current URL parameter or default to the designated inactive state
  const currentParamValue = searchParams.get(paramKey) || inactiveValue
  const isChecked = currentParamValue === activeValue

  const handleToggle = (checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (checked) {
      params.set(paramKey, activeValue)
    } else {
      params.set(paramKey, inactiveValue)
    }
    
    // Perform layout routing updates cleanly without forcing window resets
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const generatedHtmlId = React.useId()

  return (
    <div className={cn(
      "flex items-center space-x-2.5 bg-white dark:bg-zinc-950 px-3 py-1.5 rounded-lg transition-all border border-zinc-200 dark:border-zinc-800 shadow-2xs",
      className
    )}>
      <Switch 
        id={generatedHtmlId} 
        checked={isChecked}
        onCheckedChange={handleToggle}
        className="data-[state=checked]:bg-zinc-900 dark:data-[state=checked]:bg-zinc-50"
      />
      <Label 
        htmlFor={generatedHtmlId} 
        className="text-xs font-semibold tracking-tight text-zinc-600 dark:text-zinc-400 cursor-pointer select-none min-w-[95px] text-left transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        {isChecked ? activeLabel : inactiveLabel}
      </Label>
    </div>
  )
}

/**
 * A universal URL Query Parameter toggle switch wrapped cleanly in a React Suspense Boundary.
 */
export function QueryParamToggle(props: QueryParamToggleProps) {
  return (
    <React.Suspense fallback={<div className="h-9 w-32 bg-zinc-100 dark:bg-zinc-900 rounded-lg animate-pulse" />}>
      <QueryParamToggleInner {...props} />
    </React.Suspense>
  )
}