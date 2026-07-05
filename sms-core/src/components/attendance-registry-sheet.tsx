"use client"

import * as React from "react"
import { useState, useMemo, useCallback } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Save, UserCheck, ShieldCheck, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE"

interface StudentRow {
  id: string
  indexNumber: string
  fullName: string
  status: AttendanceStatus
}

interface AttendanceRegistrySheetProps {
  sectionId: string
  sectionLabel: string
}

// Mock initial data setup using your clean string union logic
const INITIAL_ROLL_CALL: StudentRow[] = [
  { id: "stu-1", indexNumber: "UCC-2024-0481", fullName: "Emmanuel Hagan", status: "PRESENT" },
  { id: "stu-2", indexNumber: "UCC-2024-1102", fullName: "Abigail Mensah", status: "PRESENT" },
  { id: "stu-3", indexNumber: "UCC-2024-0891", fullName: "Kofi Ansah Boateng", status: "ABSENT" },
  { id: "stu-4", indexNumber: "UCC-2024-1340", fullName: "Priscilla Osei", status: "PRESENT" },
  { id: "stu-5", indexNumber: "UCC-2024-0312", fullName: "Kwame Asante Opoku", status: "LATE" },
  { id: "stu-6", indexNumber: "UCC-2024-1905", fullName: "Blessing Arthur", status: "PRESENT" },
]

export function AttendanceRegistrySheet({ sectionId, sectionLabel }: AttendanceRegistrySheetProps) {
  const [registry, setRegistry] = useState<StudentRow[]>(INITIAL_ROLL_CALL)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Dynamically computed metrics for tracking ledger metadata
  const metrics = useMemo(() => {
    const total = registry.length
    const present = registry.filter(s => s.status === "PRESENT").length
    const absent = registry.filter(s => s.status === "ABSENT").length
    const late = registry.filter(s => s.status === "LATE").length
    return { total, present, absent, late }
  }, [registry])

  // Flat mutation handler for zero-friction toggles
  const updateStatus = useCallback((studentId: string, nextStatus: AttendanceStatus) => {
    setRegistry(prev =>
      prev.map(row => (row.id === studentId ? { ...row, status: nextStatus } : row))
    )
  }, [])

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      // Simulating API sync interaction window
      await new Promise(resolve => setTimeout(resolve, 800))
      
      toast.success("Attendance sheet synchronized", {
        description: `Successfully filed registry tracking matrices for ${sectionLabel}.`,
      })
    } catch (error) {
      toast.error("Transmission layout crash detected.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Dynamic Summary Micro-Ledger */}
      <div className="flex items-center justify-between border border-zinc-200 bg-card p-3 rounded-md dark:border-zinc-800">
        <div className="flex items-center gap-4 text-xs font-mono text-zinc-600 dark:text-zinc-400">
          <div>Total: <span className="font-bold text-zinc-900 dark:text-zinc-100">{metrics.total}</span></div>
          <div className="w-[1px] h-3 bg-zinc-200 dark:bg-zinc-800" />
          <div>Present: <span className="font-bold text-zinc-900 dark:text-zinc-100">{metrics.present}</span></div>
          <div className="w-[1px] h-3 bg-zinc-200 dark:bg-zinc-800" />
          <div>Absent: <span className="font-bold text-zinc-900 dark:text-zinc-100">{metrics.absent}</span></div>
          <div className="w-[1px] h-3 bg-zinc-200 dark:bg-zinc-800" />
          <div>Late: <span className="font-bold text-zinc-900 dark:text-zinc-100">{metrics.late}</span></div>
        </div>
        
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
          <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" /> Lock State
        </div>
      </div>

      {/* Flat High-Density Layout Matrix */}
      <div className="rounded-md border border-zinc-200 bg-card overflow-hidden dark:border-zinc-800">
        <Table>
          <TableHeader className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800">
            <TableRow className="hover:bg-transparent border-b-0 whitespace-nowrap">
              <TableHead className="py-2.5 px-3 h-10 text-xs font-semibold text-zinc-600 dark:text-zinc-400 border-r border-zinc-200 dark:border-zinc-800 w-40">
                Index Number
              </TableHead>
              <TableHead className="py-2.5 px-3 h-10 text-xs font-semibold text-zinc-600 dark:text-zinc-400 border-r border-zinc-200 dark:border-zinc-800">
                Full Name
              </TableHead>
              <TableHead className="py-2.5 px-3 h-10 text-xs font-semibold text-zinc-600 dark:text-zinc-400 text-center w-24 border-r border-zinc-200 dark:border-zinc-800">
                Present
              </TableHead>
              <TableHead className="py-2.5 px-3 h-10 text-xs font-semibold text-zinc-600 dark:text-zinc-400 text-center w-24 border-r border-zinc-200 dark:border-zinc-800">
                Absent
              </TableHead>
              <TableHead className="py-2.5 px-3 h-10 text-xs font-semibold text-zinc-600 dark:text-zinc-400 text-center w-24">
                Late
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {registry.map((row) => (
              <TableRow 
                key={row.id}
                className="hover:bg-zinc-100/40 dark:hover:bg-zinc-800/40 border-b border-zinc-200 last:border-b-0 dark:border-zinc-800 whitespace-nowrap transition-colors"
              >
                <TableCell className="py-2 px-3 border-r border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-500">
                  {row.indexNumber}
                </TableCell>
                <TableCell className="py-2 px-3 border-r border-zinc-200 dark:border-zinc-800 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {row.fullName}
                </TableCell>
                
                {/* Present Checkbox Trigger */}
                <TableCell className="py-2 px-3 text-center border-r border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-center">
                    <Checkbox 
                      checked={row.status === "PRESENT"}
                      onCheckedChange={() => updateStatus(row.id, "PRESENT")}
                    />
                  </div>
                </TableCell>

                {/* Absent Checkbox Trigger */}
                <TableCell className="py-2 px-3 text-center border-r border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-center">
                    <Checkbox 
                      checked={row.status === "ABSENT"}
                      onCheckedChange={() => updateStatus(row.id, "ABSENT")}
                    />
                  </div>
                </TableCell>

                {/* Late Checkbox Trigger */}
                <TableCell className="py-2 px-3 text-center">
                  <div className="flex items-center justify-center">
                    <Checkbox 
                      checked={row.status === "LATE"}
                      onCheckedChange={() => updateStatus(row.id, "LATE")}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Floating Action Bar Form Trigger */}
      <div className="flex justify-end pt-2">
        <Button
          disabled={isSubmitting}
          onClick={handleSubmit}
          className="h-9 px-4 bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 font-medium text-xs rounded shadow-sm gap-2 transition-all"
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Commit Registry
        </Button>
      </div>
    </div>
  )
}