"use client"

import * as React from "react"
import { Settings as SettingsIcon, Building2, Database, ScrollText } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import InstitutionPanel from "@/components/settings-institution-panel"
import DataPanel from "@/components/settings-data-panel"
import SystemPanel from "@/components/settings-system-panel"
import { Badge } from "@/components/ui/badge"

/**
 * Settings hub (admin-only).
 *
 * Three sections, GitHub-style:
 *  - Institution: school identity + currency (GHS by default)
 *  - Data: row counts, CSV export, guarded zone wipes (type-the-code to confirm)
 *  - System: recent audit trail (incl. every wipe)
 */
export default function SettingsWorkspace() {
  const [tab, setTab] = React.useState("institution")

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <SettingsIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight tracking-tight sm:text-lg">Settings</h1>
              <p className="text-xs text-muted-foreground">
                School profile, data control and system audit
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="ml-auto hidden sm:inline-flex">
            Admin only
          </Badge>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Tabs value={tab} onValueChange={setTab} className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
          <TabsList className="w-full grid grid-cols-3 sm:w-auto">
            <TabsTrigger value="institution" className="gap-1.5 sm:min-h-9">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Institution</span>
              <span className="sm:hidden">School</span>
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-1.5 sm:min-h-9">
              <Database className="h-4 w-4" />
              Data
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-1.5 sm:min-h-9">
              <ScrollText className="h-4 w-4" />
              System
            </TabsTrigger>
          </TabsList>

          <TabsContent value="institution" className="mt-4">
            <InstitutionPanel />
          </TabsContent>
          <TabsContent value="data" className="mt-4">
            <DataPanel />
          </TabsContent>
          <TabsContent value="system" className="mt-4">
            <SystemPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
