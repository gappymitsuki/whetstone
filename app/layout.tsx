import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Whetstone — sharpen AI agents against expert judgment",
  description:
    "A runtime layer that turns expert judgments into reusable rules and lowers an AI agent's escalation rate.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
