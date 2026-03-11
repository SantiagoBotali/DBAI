import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "DBAI — AI-Powered Database Manager",
  description: "Lightweight DBMS with an AI DBA assistant powered by Claude",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col h-screen overflow-hidden bg-bg text-text-primary">
        <Navigation />
        <main className="flex-1 overflow-hidden flex flex-col min-h-0">
          {children}
        </main>
      </body>
    </html>
  );
}
