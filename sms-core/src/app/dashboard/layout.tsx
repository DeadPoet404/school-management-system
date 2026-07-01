import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TooltipProvider delayDuration={0}>
      {/* CHANGED: Switched defaultOpen to false to make it closed by default */}
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

          {/* Core Page Content Viewport */}
          <main className="flex-1 overflow-y-auto p-1">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}