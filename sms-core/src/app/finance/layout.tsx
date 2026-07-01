import * as React from "react"
import { Suspense } from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { ViewToggle } from "@/components/view-toggle"

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TooltipProvider delayDuration={0}>
      {/* MAINTAINED: Switched defaultOpen to false to make it closed by default */}
      <SidebarProvider defaultOpen={false}>
        {/* Our updated composable sidebar */}
        <AppSidebar />
        
        {/* SidebarInset gives the main canvas a modern framed panel container */}
        <SidebarInset className="bg-background transition-all duration-200 ease-linear">
          <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <span className="text-sm font-medium tracking-tight text-muted-foreground">
                Platform Workspace
              </span>
            </div>
          </header>

          {/* Content Canvas Wrapper to hold the floating view controller */}
          <div className="relative flex-1 flex flex-col min-h-0">
            
            {/* 
              Floating View Switch 
              Positions directly at the top right corner of page.tsx content, completely separated from the header 
            */}
            <div className="absolute top-4 right-6 z-40 hidden md:block">
              <Suspense fallback={<div className="h-9 w-[220px] bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-lg" />}>
                <ViewToggle />
              </Suspense>
            </div>

            {/* Core Page Content Viewport */}
            <main className="flex-1 overflow-y-auto p-1">
              {children}
            </main>
            
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}