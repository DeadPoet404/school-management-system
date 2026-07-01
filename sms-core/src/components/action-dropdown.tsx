"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface ActionDropdownItem {
  label: string
  icon?: LucideIcon
  onClick?: () => void
  disabled?: boolean
}

interface ActionDropdownProps {
  label?: string
  menuLabel?: string
  items: ActionDropdownItem[]
  align?: "start" | "center" | "end"
  className?: string
}

export function ActionDropdown({
  label = "Actions",
  menuLabel,
  items,
  align = "end",
  className,
}: ActionDropdownProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`
            h-9
            rounded-md
            bg-[#fafafa]
            text-stone-500
            font-normal
            border-stone-300
            transition-colors
            shadow-none
            flex
            items-center
            gap-2
            select-none
            outline-none
            focus:ring-0
            focus-visible:ring-0
            hover:bg-[#f0f0f0]
            focus:bg-[#f0f0f0]
            active:bg-[#f0f0f0]
            data-[state=open]:bg-[#f0f0f0]
            data-[state=open]:hover:bg-[#fafafa]
            dark:bg-stone-900
            dark:text-slate-200
            dark:hover:bg-stone-800
            dark:focus:bg-stone-800
            dark:data-[state=open]:bg-stone-800
            dark:data-[state=open]:hover:bg-stone-900
            ${className || ""}
          `}
        >
          {label}
          <ChevronDown className="h-3.5 w-3.5 text-stone-500" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        className="w-52 rounded-sm shadow-md border border-stone-200 dark:border-stone-800"
      >
        {menuLabel && (
          <>
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
              {menuLabel}
            </DropdownMenuLabel>

            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuGroup>
          {items.map((item) => {
            const Icon = item.icon

            return (
              <DropdownMenuItem
                key={item.label}
                disabled={item.disabled}
                onClick={item.onClick}
                className="cursor-pointer"
              >
                {Icon && (
                  <Icon className="mr-2 h-4 w-4 text-stone-500" />
                )}

                <span>{item.label}</span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
