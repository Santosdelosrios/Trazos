/**
 * Hook de analytics para la landing — LISTO PARA ACTIVAR, no instalado.
 *
 * Nota: Google Analytics y Vercel Analytics YA están activos en src/app/layout.tsx.
 * Este componente queda preparado por si querés sumar Plausible (privacy-first,
 * sin cookies, ideal para LATAM) o PostHog (producto + funnels).
 *
 * --- Opción A: Plausible (recomendado para una landing) ---
 * 1) Agregar el dominio en plausible.io
 * 2) Descomentar el <Script> de abajo y renderizar <LandingAnalytics /> en page.tsx
 *
 * --- Opción B: PostHog ---
 * 1) npm i posthog-js
 * 2) Inicializar en un Provider client-side con NEXT_PUBLIC_POSTHOG_KEY
 */

// import Script from "next/script";

export default function LandingAnalytics() {
  return null;

  // --- Plausible (descomentar para activar) ---
  // return (
  //   <Script
  //     defer
  //     data-domain="trazosdemaestra.com.ar"
  //     src="https://plausible.io/js/script.js"
  //     strategy="afterInteractive"
  //   />
  // );
}
