"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { fetchWithAuth } from "@/lib/fetch-with-auth"

type AttendanceRecord = {
  id: string
  date: string
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"
  remarks?: string | null
  createdAt?: string
  updatedAt?: string
}

type AttendancePayload = {
  student?: {
    id: string
    studentId: string
    studentName: string
    attendanceRate?: number
    status?: string
    enrollmentDate?: string
    placement?: {
      classId?: string | null
    class?: { name?: string | null; section?: string | null } | null
      academicTrack?: string | null
      boardingStatus?: string | null
    } | null
    demographics?: {
      gender?: string | null
    } | null
  }
  history?: AttendanceRecord[]
  metrics?: {
    presentCount?: number
    absentCount?: number
    lateCount?: number
    excusedCount?: number
    totalCount?: number
    rate?: number
  }
}

const statusClasses: Record<string, string> = {
  PRESENT:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400",
  LATE:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400",
  ABSENT:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400",
  EXCUSED:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-400",
}

function formatDate(value?: string) {
  if (!value) {
    return "—"
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string | number
  tone?: "default" | "good" | "warn" | "bad"
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "bad"
          ? "text-red-600 dark:text-red-400"
          : "text-zinc-900 dark:text-zinc-100"

  return (
    <div className="rounded-xl border border-zinc-200 bg-white/70 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${toneClass}`}>
        {value}
      </p>
    </div>
  )
}

export default function StudentAttendancePage() {
  const params = useParams<{ id?: string | string[] }>()
  const router = useRouter()

  const rawId = Array.isArray(params.id) ? params.id[0] : params.id
  const studentId = rawId ? decodeURIComponent(rawId) : ""

  const [payload, setPayload] = useState<AttendancePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAttendance = useCallback(async () => {
    if (!studentId) {
      setError("Missing student ID.")
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetchWithAuth(
        `/attendance/student/${encodeURIComponent(studentId)}?limit=200`
      )

      const json = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          json?.message || `Attendance request failed with HTTP ${response.status}.`
        )
      }

      if (!json?.success) {
        throw new Error(json?.message || "Attendance endpoint returned an error.")
      }

      setPayload(json.data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load student attendance history."
      )
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    void loadAttendance()
  }, [loadAttendance])

  const history = payload?.history ?? []
  const metrics = payload?.metrics ?? {}
  const student = payload?.student

  const attendanceTone = useMemo(() => {
    const rate = Number(metrics.rate ?? 0)

    if (rate >= 90) {
      return "good"
    }

    if (rate >= 75) {
      return "warn"
    }

    return "bad"
  }, [metrics.rate])

  return (
    <div className="flex min-h-screen w-full flex-col gap-5 overflow-y-auto px-6 py-6">
      <div className="flex flex-col gap-4 border-b border-zinc-100 pb-4 dark:border-zinc-900 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/students")}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Students
          </Button>

          <h1 className="text-3xl font-medium tracking-tight text-zinc-950 dark:text-zinc-50">
            Student Attendance Report
          </h1>

          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {student
              ? `${student.studentName} · ${student.studentId}`
              : `Student reference: ${studentId}`}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void loadAttendance()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-xs font-mono tracking-tight text-zinc-400 animate-pulse dark:text-zinc-500">
          Loading student attendance history...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200/50 bg-red-50/30 p-4 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/10 dark:text-red-400">
          {error}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Attendance Rate"
              value={`${metrics.rate ?? 100}%`}
              tone={attendanceTone}
            />
            <StatCard label="Present" value={metrics.presentCount ?? 0} tone="good" />
            <StatCard label="Late" value={metrics.lateCount ?? 0} tone="warn" />
            <StatCard label="Absent" value={metrics.absentCount ?? 0} tone="bad" />
            <StatCard label="Excused" value={metrics.excusedCount ?? 0} />
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white/70 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Student
                </p>
                <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                  {student?.studentName ?? "—"}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Public ID
                </p>
                <p className="mt-1 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                  {student?.studentId ?? "—"}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Class
                </p>
                <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                  {student?.placement?.class?.name ?? "Unassigned"}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Total Records
                </p>
                <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                  {metrics.totalCount ?? history.length}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white/70 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-900">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Attendance History
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Showing the latest {history.length} attendance record(s).
              </p>
            </div>

            {history.length === 0 ? (
              <div className="p-6 text-sm text-zinc-500">
                No attendance records found for this student.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/50 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Remarks</th>
                      <th className="px-4 py-3 font-medium">Updated</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                    {history.map((record) => (
                      <tr key={record.id}>
                        <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                          {formatDate(record.date)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${
                              statusClasses[record.status] ??
                              "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                            }`}
                          >
                            {record.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {record.remarks || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {formatDate(record.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
