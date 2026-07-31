import { Toaster } from "@/components/ui/sonner"
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mabrook Systems",
  description: "Developing software for the future",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="RTL">
      <body
        // Browser extensions (e.g. Grammarly) inject attributes like
        // `data-gr-ext-installed` onto <body> before React hydrates, which
        // triggers a harmless hydration-attribute-mismatch warning. This
        // suppresses that warning for <body>'s own attributes only.
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
