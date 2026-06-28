import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EDOF Financial Dashboard & CRM",
  description: "Tableau de bord financier avec synchronisation automatisée Wedof & Pennylane",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex bg-zinc-950 text-zinc-50 selection:bg-blue-600/30 selection:text-blue-200 relative overflow-hidden">
        <div className="ambient-glow-1" />
        <div className="ambient-glow-2" />
        <ErrorBoundary>
          <div className="flex h-screen w-screen overflow-hidden relative z-10 w-full">
            {/* Sidebar Navigation */}
            <Sidebar />

            {/* Main Content Pane */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-zinc-950/10">
              <TopBar />
              <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8 max-w-[1600px] w-full mx-auto relative z-10">
                {children}
              </main>
            </div>
          </div>
        </ErrorBoundary>
      </body>
    </html>
  );
}
