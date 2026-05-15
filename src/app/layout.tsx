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
      <body style={{ margin: 0, padding: 0 }}>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(function(reg) {
                console.log('Service Worker ativo!');
              }).catch(function(err) {
                console.error('Falha no SW:', err);
              });
            });
          }
        ` }} />
      </body>
    </html>
  );
}
