import "@/app/globals.css";
import type { Viewport, Metadata } from "next";
import { Poppins } from "next/font/google";
import { Providers } from "./providers";
import { EnvironmentBanner } from "@/components/environment-banner";
import { SwRegister } from "@/components/sw-register";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "SMS Core",
  description: "Platform Workspace",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Jocomfy Bus",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#10254a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          {children}
          <EnvironmentBanner />
          <SwRegister />
        </Providers>
      </body>
    </html>
  );
}
