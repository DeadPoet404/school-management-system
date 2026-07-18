"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { ArrowLeft, Save, Loader2, Check, X, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface StudentAttendanceRecord {
  id: string;
  indexNumber: string;
  fullName: string;
  status: AttendanceStatus;
}

export default function MobileAttendancePage() {
  const [students, setStudents] = useState<StudentAttendanceRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "PRESENT" | "ABSENT" | "LATE" | "EXCUSED">("ALL");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [classId, setClassId] = useState("");

  useEffect(() => {
    async function loadStudents() {
      try {
        setIsLoading(true)
        setFetchError(null)
        const response = await fetchWithAuth("/students?limit=500")
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json()
        const data: Array<Record<string, unknown>> = payload.data || []
        setStudents(
          data.map((s) => ({
            id: (s.id as string) || "",
            indexNumber: (s.studentId as string) || (s.id as string),
            fullName: (s.studentName as string) || (s.account as Record<string, string>)?.fullName || "Unknown",
            status: "PRESENT" as AttendanceStatus,
          }))
        )
      } catch {
        setFetchError("Unable to load students.")
      } finally {
        setIsLoading(false)
      }
    }
    loadStudents()
  }, [])

  const metrics = useMemo(() => ({
    total: students.length,
    present: students.filter((s) => s.status === "PRESENT").length,
    absent: students.filter((s) => s.status === "ABSENT").length,
    late: students.filter((s) => s.status === "LATE").length,
    excused: students.filter((s) => s.status === "EXCUSED").length,
  }), [students]);

  const filteredStudents = useMemo(() => {
    if (activeFilter === "ALL") return students;
    return students.filter((student) => student.status === activeFilter);
  }, [students, activeFilter]);

  const handleBulkStatus = useCallback((targetStatus: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((student) => {
        const matchesFilter = activeFilter === "ALL" || student.status === activeFilter;
        return matchesFilter ? { ...student, status: targetStatus } : student;
      })
    );
    toast.success(`Active view marked as ${targetStatus.toLowerCase()}`);
  }, [activeFilter]);

  const handleSingleStatus = useCallback((id: string, targetStatus: AttendanceStatus) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, status: targetStatus } : s)));
  }, []);

  const handleSubmit = async () => {
    if (!classId.trim()) {
      toast.error("Class ID is required.");
      return;
    }
    try {
      setIsSubmitting(true);
      const response = await fetchWithAuth("/attendance/section", {
        method: "POST",
        body: JSON.stringify({
          date,
          classId: classId.trim(),
          records: students.map((s) => ({ studentId: s.id, status: s.status })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
      toast.success("Attendance submitted", { description: `${students.length} records for ${date}.` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-400 text-sm">
        Loading students...
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-destructive">{fetchError}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans antialiased max-w-md mx-auto border-x border-zinc-200 dark:border-zinc-800 flex flex-col pb-28 dark:bg-zinc-950">

      <header className="sticky top-0 bg-white/95 backdrop-blur-md z-30 px-4 pt-4 pb-3 border-b border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex items-center justify-between mb-3">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <ArrowLeft className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
          </Button>
          <div className="text-center">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Class Attendance</h1>
          </div>
          <div className="w-8" />
        </div>

        <div className="flex gap-2 mb-3">
          <div className="flex-1 space-y-1">
            <Label className="text-[10px] font-mono text-zinc-400 uppercase">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-7 text-xs" />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-[10px] font-mono text-zinc-400 uppercase">Class ID</Label>
            <Input placeholder="cls-abc123" value={classId} onChange={(e) => setClassId(e.target.value)} className="h-7 text-xs" />
          </div>
        </div>

        <div className="w-full flex items-center bg-zinc-100 p-1 rounded border border-zinc-200/60 dark:bg-zinc-900 dark:border-zinc-800/60 overflow-x-auto no-scrollbar">
          {(["ALL", "PRESENT", "ABSENT", "LATE", "EXCUSED"] as const).map((filter) => {
            const countMap = { ALL: metrics.total, PRESENT: metrics.present, ABSENT: metrics.absent, LATE: metrics.late, EXCUSED: metrics.excused };
            return (
              <button key={filter} type="button" onClick={() => setActiveFilter(filter)}
                className={cn(
                  "flex-1 text-center py-1.5 rounded text-[10px] font-medium transition-all tracking-tight whitespace-nowrap px-2",
                  activeFilter === filter ? "bg-white text-zinc-900 shadow-sm font-semibold border border-zinc-200/20 dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                )}>
                {filter === "ALL" ? "All" : filter.charAt(0) + filter.slice(1).toLowerCase()} ({countMap[filter]})
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-900">
          <span className="text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-wider">Bulk:</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" className="h-6 text-[10px] font-mono px-2 rounded border-zinc-200 text-zinc-600 dark:text-zinc-400" onClick={() => handleBulkStatus("PRESENT")}>All Present</Button>
            <Button variant="outline" className="h-6 text-[10px] font-mono px-2 rounded border-zinc-200 text-zinc-600 dark:text-zinc-400" onClick={() => handleBulkStatus("ABSENT")}>All Absent</Button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-3 space-y-2">
        {filteredStudents.map((student) => {
          const isPresent = student.status === "PRESENT";
          return (
            <div key={student.id} className={cn("flex flex-col rounded-md border border-zinc-200 dark:border-zinc-800 transition-all overflow-hidden bg-white dark:bg-zinc-900", isPresent && "border-zinc-300 dark:border-zinc-700 bg-zinc-50/30")}>
              <div onClick={() => handleSingleStatus(student.id, isPresent ? "ABSENT" : "PRESENT")} className="flex items-center justify-between p-4 active:bg-zinc-50 dark:active:bg-zinc-800 cursor-pointer select-none">
                <div className="min-w-0 flex-1 pr-3">
                  <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 tracking-tight truncate">{student.fullName}</h3>
                  <p className="text-[10px] text-zinc-400 font-mono tracking-wide mt-0.5">{student.indexNumber}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={cn("text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded", isPresent && "text-zinc-900 bg-zinc-100 dark:text-zinc-100 dark:bg-zinc-800", student.status === "ABSENT" && "text-zinc-400 dark:text-zinc-500", (student.status === "LATE" || student.status === "EXCUSED") && "text-zinc-500 underline decoration-dotted")}>{student.status.toLowerCase()}</span>
                  <div className={cn("h-6 w-6 rounded-full border flex items-center justify-center transition-all", isPresent ? "bg-zinc-900 border-zinc-950 text-white dark:bg-zinc-100 dark:border-zinc-50 dark:text-zinc-950" : "border-zinc-300 dark:border-zinc-700")}>
                    {isPresent && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                  </div>
                </div>
              </div>
              <div className="flex border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 divide-x divide-zinc-100 dark:divide-zinc-800">
                <button type="button" onClick={() => handleSingleStatus(student.id, "ABSENT")} className={cn("flex-1 py-2 text-[10px] font-mono font-medium flex items-center justify-center gap-1.5 transition-colors", student.status === "ABSENT" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800")}><X className="h-3 w-3" /> Absent</button>
                <button type="button" onClick={() => handleSingleStatus(student.id, "LATE")} className={cn("flex-1 py-2 text-[10px] font-mono font-medium flex items-center justify-center gap-1.5 transition-colors", student.status === "LATE" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800")}><Clock className="h-3 w-3" /> Late</button>
                <button type="button" onClick={() => handleSingleStatus(student.id, "EXCUSED")} className={cn("flex-1 py-2 text-[10px] font-mono font-medium flex items-center justify-center gap-1.5 transition-colors", student.status === "EXCUSED" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800")}><AlertCircle className="h-3 w-3" /> Excused</button>
              </div>
            </div>
          );
        })}
        {filteredStudents.length === 0 && (
          <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-md">
            <p className="text-xs font-mono text-muted-foreground">No students found.</p>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/80 backdrop-blur-md border-t border-zinc-200 px-4 py-3.5 z-40 dark:bg-zinc-950/80 dark:border-zinc-800">
        <Button disabled={isSubmitting} onClick={handleSubmit} className="w-full h-10 bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 font-semibold text-xs rounded transition-all flex items-center justify-center gap-2">
          {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Submit Attendance
        </Button>
      </div>
    </div>
  );
}
