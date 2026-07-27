import { BarChart3, FileText, PieChart, TrendingUp } from "lucide-react"

export default function ReportingPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-muted p-3">
              <BarChart3 className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Reporting
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                Institutional reports
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                This page is reserved for academic, attendance, finance, staffing,
                and operational reports.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">Standard reports</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Generate recurring reports for enrollment, grades, attendance, and fees.
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">Trends and analytics</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Future implementation can summarize performance and operational trends.
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <PieChart className="h-5 w-5 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">Export center</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Future implementation can support CSV, PDF, and spreadsheet exports.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
