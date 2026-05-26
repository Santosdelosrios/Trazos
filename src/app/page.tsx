import LandingNav from "@/components/landing/LandingNav";
import Hero from "@/components/landing/Hero";
import PainSection from "@/components/landing/PainSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import TizaSection from "@/components/landing/TizaSection";
import SocialProof from "@/components/landing/SocialProof";
import PricingSection from "@/components/landing/PricingSection";
import FAQ, { FAQ_ITEMS } from "@/components/landing/FAQ";
import FinalCTA from "@/components/landing/FinalCTA";
import LandingFooter from "@/components/landing/LandingFooter";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.pregunta,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.respuesta,
    },
  })),
};

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-50 text-surface-900">
      {/* Fondo de hoja rayada sutil */}
      <div className="trazos-notebook pointer-events-none fixed inset-0 -z-10 opacity-40" />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <LandingNav />

      <main>
        <Hero />
        <PainSection />
        <FeaturesSection />
        <TizaSection />
        <SocialProof />
        <PricingSection />
        <FAQ />
        <FinalCTA />
      </main>

      <LandingFooter />
    </div>
  );
}
