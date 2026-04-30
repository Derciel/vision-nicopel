import type { Metadata } from "next";
import "./globals.css";
import "video.js/dist/video-js.css";

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
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>{children}</body>
    </html>
  );
}
