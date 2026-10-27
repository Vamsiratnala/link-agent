import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// Every page reads the local database (the nav shows the last search time).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Link Agent",
  description: "Job openings from LinkedIn posts, with the email to apply to.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh font-sans">
        <Nav />
        <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-10 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
