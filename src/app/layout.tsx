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
    default: "Trazos de Maestra | Agenda digital con IA para docentes particulares",
    template: "%s | Trazos de Maestra",
  },
  description: "Trazos de Maestra es la agenda digital y plataforma integral para docentes y profesores particulares en Argentina. Generá ejercicios con IA, organizá clases, alumnos, finanzas y reportes desde un solo lugar.",
  applicationName: "Trazos de Maestra",
  keywords: [
    "Trazos",
    "Trazos de Maestra",
    "trazosdemaestra",
    "agenda para maestras particulares",
    "app para profesores particulares",
    "gestión de clases particulares",
    "IA para docentes",
    "ejercicios con IA",
    "seguimiento de alumnos",
    "reportes para padres",
    "psicopedagogía",
    "clases particulares Argentina",
  ],
  authors: [{ name: "Trazos de Maestra" }],
  creator: "Trazos de Maestra",
  publisher: "Trazos de Maestra",
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Trazos de Maestra | Tu cuaderno digital con IA para clases particulares",
    description: "La herramienta indispensable para docentes particulares. Llevá tu agenda, finanzas y el progreso de tus alumnos en un solo lugar.",
    url: "https://trazosdemaestra.com.ar",
    siteName: "Trazos de Maestra",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Trazos de Maestra - Plataforma para docentes particulares",
      },
    ],
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trazos de Maestra | Plataforma para docentes particulares",
    description: "Organizá tus clases particulares con Trazos: agenda, alumnos, IA y reportes.",
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
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/icon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
    shortcut: '/icon.png',
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Trazos de Maestra",
  alternateName: ["Trazos", "trazosdemaestra"],
  url: "https://trazosdemaestra.com.ar",
  logo: "https://trazosdemaestra.com.ar/logo.png",
  description:
    "Plataforma integral para docentes y profesores particulares. Agenda digital, generación de ejercicios con IA, seguimiento de alumnos y gestión de cobranzas.",
  email: "trazosdemaestra@gmail.com",
  areaServed: "AR",
  inLanguage: "es-AR",
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Trazos de Maestra",
  alternateName: "Trazos",
  url: "https://trazosdemaestra.com.ar",
  inLanguage: "es-AR",
  publisher: {
    "@type": "Organization",
    name: "Trazos de Maestra",
    logo: {
      "@type": "ImageObject",
      url: "https://trazosdemaestra.com.ar/logo.png",
    },
  },
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Trazos de Maestra",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  description:
    "App para que maestras y profesores particulares gestionen su agenda, alumnos, finanzas y generen ejercicios con IA.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "ARS",
  },
  url: "https://trazosdemaestra.com.ar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" className={`${nunito.variable} ${geistMono.variable} h-full`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
