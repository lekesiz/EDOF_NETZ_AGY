import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
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
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-50 selection:bg-blue-600/30 selection:text-blue-200 relative">
        <div className="ambient-glow-1" />
        <div className="ambient-glow-2" />
        <ErrorBoundary>
          <Header />
          <main className="flex-1 flex flex-col max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
            {children}
          </main>
        </ErrorBoundary>
      </body>
    </html>
  );
}
