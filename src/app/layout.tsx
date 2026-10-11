import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const onest = Onest({ subsets: ["latin", "latin-ext"], variable: "--font-onest", display: "swap" });

export const metadata: Metadata = {
  title: "Nivo",
  description: "Controle seus gastos do mês conversando.",
  applicationName: "Nivo",
  icons: {
    icon: "/icons/favicon-48.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Nivo", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#edf1f0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={onest.variable}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
