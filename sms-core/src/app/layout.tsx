import "@/app/globals.css"
import { Poppins } from "next/font/google"

// Initialize Poppins with the variable hook
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700"],
  variable: "--font-sans", // Overwrites default sans system font string
})

export const metadata = {
  title: "SMS Core",
  description: "Platform Workspace",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${poppins.variable}`}> 
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
