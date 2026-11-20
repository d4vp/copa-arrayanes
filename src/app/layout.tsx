import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { AppShell } from "@/components/shell";
import { ServiceWorker } from "@/components/service-worker";
import { ToastProvider } from "@/components/toast";
import { StoreProvider } from "@/lib/data/store";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-barlow", display: "swap" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://copa-arrayanes.pages.dev";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Copa Arrayanes", template: "%s · Copa Arrayanes" },
  description: "Partidos, resultados, tabla de posiciones y estadísticas de la Copa Arrayanes. Vereda Los Arrayanes, Córdoba, Nariño.",
  applicationName: "Copa Arrayanes",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32" }, { url: "/brand/logo-mark.svg", type: "image/svg+xml" }],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Copa Arrayanes", statusBarStyle: "default" },
  openGraph: { title: "Copa Arrayanes", description: "Sigue la copa de la vereda: partidos, resultados y tabla.", images: ["/brand/og.png"], locale: "es_CO", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Aplica el tema antes de pintar para evitar parpadeo
const themeScript = `(function(){try{var c=localStorage.getItem('copa-tema')||'sistema';var d=c==='oscuro'||(c==='sistema'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO" className={`${inter.variable} ${barlow.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <StoreProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
            <ServiceWorker />
          </ToastProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
