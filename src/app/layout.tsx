import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "About Me - Visualizer",
  description: "A p5.js and Next.js project",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: 'black' }}>{children}</body>
    </html>
  );
}
