"use client"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-lg font-semibold">Dashboard Error</h2>
      <p className="text-sm text-muted-foreground">
        {error.message || "This section encountered an error."}
      </p>
      <button
        onClick={reset}
        className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
      >
        Retry
      </button>
    </div>
  )
}
