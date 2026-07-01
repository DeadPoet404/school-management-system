"use client"

import * as React from "react"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export interface ModuleTab {
  value: string
  label: string
  title?: string
  description?: string
}

interface ModuleTabsProps {
  activeTab: string
  onTabChange: (tab: string) => void
  tabs: ModuleTab[]
  className?: string
}

export function ModuleTabs({
  activeTab,
  onTabChange,
  tabs,
  className,
}: ModuleTabsProps) {
  const [hoveredTab, setHoveredTab] = React.useState<string | null>(null)

  const previewTab = tabs.find(
    (tab) => tab.value === hoveredTab
  )

  return (
    <div
      className={cn("relative inline-block", className)}
      onMouseLeave={() => setHoveredTab(null)}
    >
      <Tabs value={activeTab}>
        <TabsList className="inline-flex h-9 items-center justify-start rounded-sm bg-zinc-100/80 p-1 text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400 border border-zinc-200/40 dark:border-zinc-800/40 gap-1">
          {tabs.map((tab, index) => (
            <React.Fragment key={tab.value}>
              <TabsTrigger
                value={tab.value}
                onClick={() => onTabChange(tab.value)}
                onMouseEnter={() => setHoveredTab(tab.value)}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3.5 h-7 text-xs font-medium tracking-wide transition-all duration-150",
                  "text-zinc-600 dark:text-zinc-400",
                  "hover:text-zinc-900 dark:hover:text-zinc-100",
                  "focus-visible:outline-none focus-visible:ring-0",
                  "data-[state=active]:bg-background",
                  "data-[state=active]:text-foreground",
                  "data-[state=active]:shadow-sm"
                )}
              >
                {tab.label}
              </TabsTrigger>

              {index < tabs.length - 1 && (
                <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-800 self-center shrink-0" />
              )}
            </React.Fragment>
          ))}
        </TabsList>
      </Tabs>

      {/* Floating Preview Card */}
      {previewTab && (
        <div
          className="
            absolute
            left-0
            top-full
            mt-2
            w-[420px]
            z-50
            animate-in
            fade-in-0
            slide-in-from-top-1
            duration-150
          "
        >
          <Card className="rounded-lg shadow-lg border-zinc-200 dark:border-zinc-800 bg-background">
            <CardHeader className="p-4">
              {previewTab.title && (
                <CardTitle className="text-sm font-medium tracking-tight">
                  {previewTab.title}
                </CardTitle>
              )}

              {previewTab.description && (
                <CardDescription className="text-xs leading-relaxed mt-1">
                  {previewTab.description}
                </CardDescription>
              )}
            </CardHeader>
          </Card>
        </div>
      )}
    </div>
  )
}