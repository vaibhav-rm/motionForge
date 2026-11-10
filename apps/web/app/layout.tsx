import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MotionForge — AI Video Studio",
    template: "%s · MotionForge",
  },
  description:
    "Describe it. Visualize it. Refine it. Render it. MotionForge turns natural language into editable, high-quality videos built with Remotion.",
};

export const viewport: Viewport = {
  themeColor: "#ece7db",
  colorScheme: "light",
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
