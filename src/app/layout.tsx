import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Calorie & Macro Tracker",
  description: "Track your goals elegantly",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main className="max-w-4xl mx-auto p-4 md:p-8 w-full">
          {children}
        </main>
      </body>
    </html>
  );
}
