import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Add New Teacher | Platform Workspace",
  description: "Administrative form interface for onboarding new faculty profiles into the registry.",
}

export default function AddTeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full max-w-4xl mx-auto flex-1 h-full flex flex-col overflow-hidden pt-6 px-6 pb-16 animate-in fade-in duration-300">
      {/* No more hardcoded h-[calc(100vh-4rem)] hacks needed */}
      {/* pb-16 forces a permanent, elegant dead-zone gap at the bottom of the monitor */}
      {children}
    </div>
  )
}