"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

// --- TYPE DEF MATRIX SCHEMAS ---
export type FilterFieldType = "checkbox-group" | "combobox" | "number" | "text"

export interface FilterField {
  id: string
  label: string
  type: FilterFieldType
  placeholder?: string
  /** String choices required for checkbox-groups or selection dropdown listings */
  options?: readonly string[]
  /** Dynamic conditions applied to standard attributes (e.g. min/max thresholds) */
  min?: string | number
}

interface DynamicFilterPopoverProps {
  /** Array of active schema configuration attributes to construct in the viewport */
  fields: FilterField[]
  /** Triggered execution hook returning unified dynamic form object values */
  onApplyFilters: (filters: Record<string, any>) => void
  /** The specific text copy shown on the visual button trigger mechanism */
  triggerLabel?: string
  /** Alignment offset configuration bounds for popover anchors */
  align?: "start" | "center" | "end"
  className?: string
}

export function DynamicFilterPopover({
  fields,
  onApplyFilters,
  triggerLabel = "Filter",
  align = "end",
  className,
}: DynamicFilterPopoverProps) {
  // Unified state record containing all contextual fields data points
  const [values, setValues] = useState<Record<string, any>>({})

  // Reset values when switching domains to clean past metadata entries
  useEffect(() => {
    setValues({})
  }, [fields])

  const handleUpdateValue = (fieldId: string, value: any) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  const handleReset = () => {
    setValues({})
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onApplyFilters(values)
  }

  return (
    <Popover modal={false}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost"
          size="sm" 
          className={cn(
            "h-9 rounded-md bg-[#fafafa] text-stone-500 font-normal border border-zinc-200 transition-colors shadow-none flex items-center gap-2 select-none outline-hidden focus:ring-0 focus-visible:ring-0 hover:bg-[#f0f0f0] focus:bg-[#f0f0f0] active:bg-[#f0f0f0] data-[state=open]:bg-[#f0f0f0] data-[state=open]:hover:bg-[#fafafa] dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800 dark:data-[state=open]:bg-zinc-800 dark:data-[state=open]:hover:bg-zinc-900",
            className
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[420px] rounded-lg shadow-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 animate-in fade-in zoom-in-95 duration-150" align={align}>
        <div className="grid gap-4">
          
          <div className="space-y-1">
            <h4 className="font-semibold text-lg tracking-tight text-foreground">Advanced Data Filters</h4>
            <p className="text-xs text-muted-foreground">
              Refining system telemetry and registry metadata metrics for active viewports.
            </p>
          </div>
          
          <form onSubmit={handleSubmit}>
            <FieldGroup className="gap-5">
              {fields.map((field) => {
                const currentValue = values[field.id]

                return (
                  <div key={field.id} className="w-full">
                    {/* Render Engine Route: Checkbox Matrix Variant */}
                    {field.type === "checkbox-group" && field.options && (
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{field.label}</span>
                        <div className="grid grid-cols-3 gap-2 pt-1 pl-0.5">
                          {field.options.map((option) => (
                            <Field key={option} orientation="horizontal" className="items-center">
                              <Checkbox 
                                id={`${field.id}-${option}`} 
                                checked={currentValue === option} 
                                onCheckedChange={(checked) => handleUpdateValue(field.id, checked ? option : null)} 
                              />
                              <FieldLabel htmlFor={`${field.id}-${option}`} className="text-xs font-normal cursor-pointer select-none">
                                {option}
                              </FieldLabel>
                            </Field>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Render Engine Route: Combobox Dropdown Variant */}
                    {field.type === "combobox" && field.options && (
                      <Field>
                        <FieldLabel htmlFor={field.id} className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                          {field.label}
                        </FieldLabel>
                        <Combobox 
                          items={field.options as string[]} 
                          value={currentValue || ""} 
                          onValueChange={(val) => handleUpdateValue(field.id, val || "")}
                        >
                          <ComboboxInput id={field.id} placeholder={field.placeholder || "Select option..."} className="h-8 text-xs rounded-md" />
                          <ComboboxContent>
                            <ComboboxEmpty className="text-xs py-2 text-center text-muted-foreground">No matches located.</ComboboxEmpty>
                            <ComboboxList>
                              {(item) => <ComboboxItem key={item} value={item} className="text-xs">{item}</ComboboxItem>}
                            </ComboboxList>
                          </ComboboxContent>
                        </Combobox>
                      </Field>
                    )}

                    {/* Render Engine Route: Standard Inputs (Numeric/Text) Variant */}
                    {(field.type === "number" || field.type === "text") && (
                      <Field className="animate-in fade-in slide-in-from-top-1 duration-200">
                        <FieldLabel htmlFor={field.id} className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                          {field.label}
                        </FieldLabel>
                        <Input 
                          id={field.id}
                          type={field.type}
                          min={field.min}
                          value={currentValue || ""}
                          onChange={(e) => handleUpdateValue(field.id, e.target.value)}
                          placeholder={field.placeholder} 
                          className="h-8 text-xs rounded-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </Field>
                    )}
                  </div>
                )
              })}

              {/* Shared Control Layout Actions Block Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 mt-1 border-t border-zinc-100 dark:border-zinc-800 w-full">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  type="button" 
                  onClick={handleReset}
                  className="h-8 text-xs font-normal text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Reset
                </Button>
                <Button 
                  size="sm" 
                  type="submit" 
                  className="h-8 text-xs font-medium px-3 rounded-md bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Apply Filters
                </Button>
              </div>

            </FieldGroup>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  )
}