"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { 
  LogOut,
  ChevronDown,
  Sliders,
  GraduationCap,
} from "lucide-react"

import { DashboardIcon, BotIcon, MoneyIcon, PeopleIcon, MessageIcon, ReportIcon } from "./custom-icon"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarMenuBadge,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// SECTION 1: Core operational tools
const coreNavigationItems = [
  { title: "Dashboard", url: "/dashboard", icon: DashboardIcon },
  { title: "Students", url: "/students", icon: BotIcon, badge: "3" },
  { title: "Staff", url: "/staff", icon: PeopleIcon },
  { title: "Teachers", url: "/teachers", icon: GraduationCap },
  { title: "Operations", url: "/operations", icon: Sliders },
  { title: "Finance", url: "/finance", icon: MoneyIcon },
]

// SECTION 2: Advanced automation engines
const advancedNavigationItems = [
  { title: "Communications", url: "/communication", icon: MessageIcon },
  { title: "Reports", url: "/reporting", icon: ReportIcon },
]

interface AppSidebarProps {
  user?: { email: string; role: string } | null;
  initials?: string;
  onLogout?: () => void;
}
export function AppSidebar({ user, initials = "??", onLogout }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <Sidebar variant="inset" collapsible="icon">
      {/* 1. STICKY HEADER - Workspace / Branding Selector */}
      <SidebarHeader className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                  <div className="flex aspect-square h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                    Ω
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="font-semibold truncate">Jocomfy Int</span>
                    <span className="text-xs text-muted-foreground truncate">K-12 school</span>
                  </div>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-popper-anchor-width] min-w-56 rounded-lg" side="bottom" align="start">
                <DropdownMenuItem className="gap-2 p-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded border bg-background font-medium">C</div>
                  Civic Hub Pro
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 p-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded border bg-background font-medium">S</div>
                  Sandbox Instance
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* 2. SCROLLABLE CONTENT - Navigation Groups */}
      <SidebarContent>
        {/* GROUP A: Core Platform */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-3">Core Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {coreNavigationItems.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive} 
                      tooltip={item.title}
                      className="data-[active=true]:bg-neutral-100 dark:data-[active=true]:bg-neutral-900/50 text-black dark:text-white transition-all duration-200"
                    >
                      <Link href={item.url} className="flex items-center gap-3">
                        <item.icon 
                          className={`
                            shrink-0 size-[18px] text-black dark:text-white transition-all duration-200
                            ${isActive ? "stroke-[2]" : "stroke-[1.5]"}
                          `} 
                        />
                        <span className={`
                          tracking-wide text-black dark:text-white transition-all duration-200 group-data-[collapsible=icon]:hidden
                          ${isActive ? "font-normal" : "font-light"}
                        `}>
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                    
                    {item.badge && (
                      <SidebarMenuBadge className="group-data-[collapsible=icon]:hidden">
                        {item.badge}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* GROUP B: Advanced Operations */}
        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="px-3">Advanced</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {advancedNavigationItems.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive} 
                      tooltip={item.title}
                      className="data-[active=true]:bg-neutral-100 dark:data-[active=true]:bg-neutral-900/50 text-black dark:text-white transition-all duration-200"
                    >
                      <Link href={item.url} className="flex items-center gap-3">
                        <item.icon 
                          className={`
                            shrink-0 size-[18px] text-black dark:text-white transition-all duration-200
                            ${isActive ? "stroke-[2]" : "stroke-[1.5]"}
                          `} 
                        />
                        <span className={`
                          tracking-wide text-black dark:text-white transition-all duration-200 group-data-[collapsible=icon]:hidden
                          ${isActive ? "font-normal" : "font-light"}
                        `}>
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* 3. STICKY FOOTER - User Account Profile Panel */}
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="w-full justify-start gap-3 hover:bg-neutral-100 dark:hover:bg-neutral-900/50 transition-all duration-200"
                >
                  {/* AVATAR WRAPPER - Profile Picture */}
                  <div className="flex aspect-square h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black font-semibold text-xs uppercase shadow-sm">
                    {initials}
                  </div>
                  
                  {/* TEXT DETAILS LAYER */}
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="font-medium text-black dark:text-white truncate">user?.email?.split("@")[0] || "User"</span>
                    <span className="text-xs text-muted-foreground truncate">user?.email || "Not authenticated"</span>
                  </div>
                  
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              
              {/* DROPDOWN MENU OPTIONS */}
              <DropdownMenuContent className="w-[--radix-popper-anchor-width] min-w-56 rounded-lg" side="top" align="start">
                <DropdownMenuItem className="gap-2 p-2 text-destructive focus:text-destructive cursor-pointer"
                  onClick={onLogout}>
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>Logout Account</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* 4. INTERACTIVE SIDEBAR RAIL */}
      <SidebarRail />
    </Sidebar>
  )
}