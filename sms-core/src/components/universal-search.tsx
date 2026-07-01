"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"

interface UniversalSearchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  showShortcut?: boolean
  shortcutKey?: string
}

export function UniversalSearch({
  value,
  onChange,
  placeholder = "Search records...",
  showShortcut = true,
  shortcutKey = "k",
  className,
  ...props
}: UniversalSearchProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isMac, setIsMac] = React.useState(true)

  // Detect Operating System for correct shortcut rendering
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0)
    }
  }, [])

  // Listen for dynamic key binding patterns
  React.useEffect(() => {
    if (!showShortcut) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === shortcutKey.toLowerCase()) {
        e.preventDefault() // Stop default browser behavior
        inputRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showShortcut, shortcutKey])

  return (
    <div className={cn("relative w-full items-center", className)}>
      {/* Left Search Icon Accent */}
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      
      {/* Search Input Field */}
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "pl-9 h-9 rounded-lg bg-background text-sm transition-colors border border-zinc-200 dark:border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-400 focus-visible:border-zinc-400 dark:focus-visible:ring-zinc-700 dark:focus-visible:border-zinc-700",
          showShortcut ? "pr-14" : "pr-3"
        )}
        {...props}
      />
      
      {/* Right Aligned Keyboard Shortcut HUD */}
      {showShortcut && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none select-none">
          <Kbd className="rounded-sm bg-muted text-[10px] font-mono h-5 px-1.5 inline-flex items-center gap-0.5 border border-zinc-200 dark:border-zinc-800">
            <span>{isMac ? "⌘" : "Ctrl"}</span>
            <span className="uppercase">{shortcutKey}</span>
          </Kbd>
        </div>
      )}
    </div>
  )
}
