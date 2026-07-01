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
      <SidebarProvider defaultOpen={false} className="h-screen overflow-hidden">
        <AppSidebar />
        
        <SidebarInset className="bg-background transition-all duration-200 ease-linear flex-1 min-h-0 flex flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <span className="text-sm font-medium tracking-tight text-muted-foreground">
                Platform Workspace
              </span>
            </div>
          </header>

          <main className="w-full flex-1 min-h-0 overflow-hidden flex flex-col">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}