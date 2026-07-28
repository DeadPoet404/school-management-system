"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { ArrowLeft, Save, Loader2, Check, X, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useClasses } from "@/lib/api/reference";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface StudentAttendanceRecord {
  id: string;
  indexNumber: string;
  fullName: string;
  status: AttendanceStatus;
}

const STATUS_META: Record<
  AttendanceStatus,
  { icon: React.ReactNode; active: string; label: string }
> = {
  PRESENT: {
    icon: <Check className="h-3.5 w-3.5" />,
    active: "bg-emerald-600 text-white border-emerald-600",
    label: "Present",
  },
  ABSENT: {
    icon: <X className="h-3.5 w-3.5" />,
    active: "bg-rose-600 text-white border-rose-600",
    label: "Absent",
  },
  LATE: {
    icon: <Clock className="h-3.5 w-3.5" />,
    active: "bg-amber-500 text-white border-amber-500",
    label: "Late",
  },
  EXCUSED: {
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    active: "bg-zinc-500 text-white border-zinc-500",
    label: "Excused",
  },
};

export default function MobileAttendancePage() {
  const { data: classes = [], isLoading: classesLoading } = useClasses();
  const activeClasses = useMemo(
    () => classes.filter((c) => c.isActive !== false),
    [classes],
  );

  const [students, setStudents] = useState<StudentAttendanceRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState<
    "ALL" | AttendanceStatus
  >("ALL");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]!);
  const [classId, setClassId] = useState("");

  useEffect(() => {
    if (activeClasses.length === 0) return;
    setClassId((current) => {
      if (current && activeClasses.some((c) => c.id === current)) return current;
      return activeClasses[0]!.id;
    });
  }, [activeClasses]);

  useEffect(() => {
    if (!classId || !date) {
      setStudents([]);
      return;
    }

    let cancelled = false;

    async function loadRoster() {
      try {
        setIsLoading(true);
        setFetchError(null);
        const qs = new URLSearchParams({ date });
        const response = await fetchWithAuth(
          `/attendance/class/${encodeURIComponent(classId)}?${qs.toString()}`,
        );
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.message || `HTTP ${response.status}`);
        }
        const payload = await response.json();
        const roster: Array<Record<string, unknown>> = payload?.data?.roster || [];
        if (cancelled) return;
        setStudents(
          roster.map((s) => ({
            id: (s.studentId as string) || "",
            indexNumber:
              (s.publicStudentId as string) || (s.studentId as string) || "",
            fullName: (s.studentName as string) || "Unknown",
            status: (s.status as AttendanceStatus) || "PRESENT",
          })),
        );
      } catch (err) {
        if (!cancelled) {
          setStudents([]);
          setFetchError(
            err instanceof Error ? err.message : "Unable to load class roster.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadRoster();
    return () => {
      cancelled = true;
    };
  }, [classId, date]);

  const metrics = useMemo(
    () => ({
      total: students.length,
      present: students.filter((s) => s.status === "PRESENT").length,
      absent: students.filter((s) => s.status === "ABSENT").length,
      late: students.filter((s) => s.status === "LATE").length,
      excused: students.filter((s) => s.status === "EXCUSED").length,
    }),
    [students],
  );

  const filteredStudents = useMemo(() => {
    if (activeFilter === "ALL") return students;
    return students.filter((student) => student.status === activeFilter);
  }, [students, activeFilter]);

  const handleBulkStatus = useCallback(
    (targetStatus: AttendanceStatus) => {
      setStudents((prev) =>
        prev.map((student) => {
          const matchesFilter =
            activeFilter === "ALL" || student.status === activeFilter;
          return matchesFilter ? { ...student, status: targetStatus } : student;
        }),
      );
      toast.success(`Active view marked as ${targetStatus.toLowerCase()}`);
    },
    [activeFilter],
  );

  const handleSingleStatus = useCallback(
    (id: string, targetStatus: AttendanceStatus) => {
      setStudents((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: targetStatus } : s)),
      );
    },
    [],
  );

  const handleSubmit = async () => {
    if (!classId.trim()) {
      toast.error("Select a class first.");
      return;
    }
    if (students.length === 0) {
      toast.error("No students in this roster.");
      return;
    }
    try {
      setIsSubmitting(true);
      const response = await fetchWithAuth("/attendance/section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          classId: classId.trim(),
          records: students.map((s) => ({
            studentId: s.id,
            status: s.status,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
      toast.success("Attendance submitted", {
        description: `${students.length} records for ${date}.`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (classesLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-zinc-400 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading roster...
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-destructive">{fetchError}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans antialiased max-w-md mx-auto border-x border-zinc-200 dark:border-zinc-800 flex flex-col pb-28 dark:bg-zinc-950">
      <header className="sticky top-0 bg-white/95 backdrop-blur-md z-30 px-4 pt-4 pb-3 border-b border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
          >
            <ArrowLeft className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
          </Button>
          <div className="text-center">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Class Attendance
            </h1>
          </div>
          <div className="w-8" />
        </div>

        <div className="flex gap-2 mb-3">
          <div className="flex-1 space-y-1">
            <Label className="text-[10px] font-mono text-zinc-400 uppercase">
              Date
            </Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-[10px] font-mono text-zinc-400 uppercase">
              Class
            </Label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="h-7 w-full text-xs rounded-md border border-input bg-background px-2"
            >
              {activeClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-full flex items-center bg-zinc-100 p-1 rounded border border-zinc-200/60 dark:bg-zinc-900 dark:border-zinc-800/60 overflow-x-auto no-scrollbar">
          {(
            [
              ["ALL", metrics.total],
              ["PRESENT", metrics.present],
              ["ABSENT", metrics.absent],
              ["LATE", metrics.late],
              ["EXCUSED", metrics.excused],
            ] as const
          ).map(([key, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveFilter(key)}
              className={cn(
                "flex-1 min-w-[3.5rem] py-1 rounded text-[10px] font-semibold uppercase tracking-wide",
                activeFilter === key
                  ? "bg-white shadow-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500",
              )}
            >
              {key === "ALL" ? "All" : key.slice(0, 1)}
              <span className="ml-0.5 opacity-60">{count}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="flex gap-2 px-4 py-2 border-b border-zinc-100 dark:border-zinc-900">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px] flex-1"
          onClick={() => handleBulkStatus("PRESENT")}
          disabled={students.length === 0}
        >
          Mark present
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px] flex-1"
          onClick={() => handleBulkStatus("ABSENT")}
          disabled={students.length === 0}
        >
          Mark absent
        </Button>
      </div>

      <main className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {filteredStudents.length === 0 ? (
          <p className="text-center text-xs text-zinc-400 py-12">
            No students in this view.
          </p>
        ) : (
          filteredStudents.map((student) => (
            <div
              key={student.id}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {student.fullName}
                  </p>
                  <p className="text-[10px] font-mono text-zinc-400">
                    {student.indexNumber}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.keys(STATUS_META) as AttendanceStatus[]).map((status) => {
                  const meta = STATUS_META[status];
                  const selected = student.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleSingleStatus(student.id, status)}
                      className={cn(
                        "h-8 rounded border text-[10px] font-semibold flex items-center justify-center gap-1",
                        selected
                          ? meta.active
                          : "border-zinc-200 text-zinc-500 dark:border-zinc-700",
                      )}
                    >
                      {meta.icon}
                      {meta.label.slice(0, 1)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-3 bg-white/95 dark:bg-zinc-950/95 border-t border-zinc-200 dark:border-zinc-800 backdrop-blur">
        <Button
          className="w-full h-10 gap-2"
          disabled={isSubmitting || students.length === 0 || !classId}
          onClick={handleSubmit}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Submit {students.length} records
        </Button>
      </div>
    </div>
  );
}
