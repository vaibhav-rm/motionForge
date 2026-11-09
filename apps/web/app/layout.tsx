import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MotionForge",
  description: "AI-powered video creation studio built on Remotion.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased">
        {children}
      </body>
    </html>
  );
}
