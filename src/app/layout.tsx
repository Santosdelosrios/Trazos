import type { Metadata } from "next";
import { Nunito, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://trazosdemaestra.com.ar'),
  title: {
    default: "TRAZOS",
    template: "%s | TRAZOS",
  },
  description: "Trazos es la agenda digital y plataforma integral para maestras y profesores particulares. Generá ejercicios con IA, organizá tus clases, finanzas, y enviá reportes a padres fácilmente.",
  keywords: ["Trazos", "Trazos de maestra", "maestras", "clases particulares", "agenda para maestras", "educación", "IA para educación", "seguimiento de alumnos", "reportes para padres", "Argentina"],
  authors: [{ name: "Trazos de Maestra" }],
  creator: "Trazos de Maestra",
  publisher: "Trazos de Maestra",
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Trazos de Maestra | Tu cuaderno digital con IA",
    description: "La herramienta indispensable para maestras particulares. Llevá tu agenda, finanzas y el progreso de tus alumnos en un solo lugar.",
    url: "https://trazosdemaestra.com.ar",
    siteName: "Trazos de Maestra",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Trazos de Maestra - Plataforma educativa",
      },
    ],
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trazos de Maestra | Plataforma Educativa",
    description: "Organiza tus clases particulares con Trazos: agenda, alumnos, IA y reportes.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" className={`${nunito.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
