import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vision - Media Loop Player",
  description: "Continuous playback of high-quality premium media.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
