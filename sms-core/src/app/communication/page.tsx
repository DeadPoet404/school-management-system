import { MessageSquare, Send, Users } from "lucide-react"

export default function CommunicationPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-muted p-3">
              <MessageSquare className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Communications
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                School communication center
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                This page is reserved for announcements, parent and guardian messaging,
                staff notices, and school-wide communication workflows.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <Send className="h-5 w-5 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">Announcements</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Publish school-wide updates, reminders, and emergency notices.
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">Audience groups</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Target messages to students, guardians, faculty, staff, or specific classes.
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">Message history</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Future implementation can show delivery logs and communication audit history.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
