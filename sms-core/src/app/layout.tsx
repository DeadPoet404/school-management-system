import "@/app/globals.css";
import { Poppins } from "next/font/google";
import { Providers } from "./providers";
import { EnvironmentBanner } from "@/components/environment-banner";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata = {
  title: "SMS Core",
  description: "Platform Workspace",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          {children}
          <EnvironmentBanner />
        </Providers>
      </body>
    </html>
  );
}
