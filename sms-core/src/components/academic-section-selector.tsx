"use client"

import { cn } from "@/lib/utils"

interface Section {
  id: string
  label: string
}

interface AcademicSectionSelectorProps {
  sections: Section[]
  activeSection: string
  onChange: (section: string) => void
}

export function AcademicSectionSelector({
  sections,
  activeSection,
  onChange,
}: AcademicSectionSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onChange(section.id)}
          className={cn(
            "h-8 rounded-md px-3 text-xs font-medium transition-colors",
            activeSection === section.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          {section.label}
        </button>
      ))}
    </div>
  )
}