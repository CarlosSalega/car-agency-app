import type { Metadata } from "next";

import { SITE_CONFIG } from "@/data/metadata";
import { getPublicLatestCars } from "@/lib/queries/cars";

import FeatureCards from "./components/FeatureCards";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import { LatestCarsSlider } from "./components/LatestCarsSlider";
import { NavbarServer } from "./components/NavbarServer";
import Reviews from "./components/Reviews";
import ServicesSection from "./components/ServicesSection";
import { WhatsAppFloatButton } from "./components/ui/WhatsAppFloatButton";

export const metadata: Metadata = {
  title: "Autos usados y 0km en Santa Fe | Car Agency App",
  description:
    "Comprá o vendé tu auto en Santa Fe con Car Agency App: atención personalizada, financiación a medida y unidades usadas y 0km seleccionadas. ¡Visitános hoy!",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Autos usados y 0km en Santa Fe | Car Agency App",
    description:
      "Comprá o vendé tu auto en Santa Fe con Car Agency App: atención personalizada, financiación a medida y unidades usadas y 0km seleccionadas. ¡Visitános hoy!",
    url: "/",
    siteName: SITE_CONFIG.name,
    images: [
      {
        url: `${SITE_CONFIG.url}${SITE_CONFIG.previewPath}`,
        width: SITE_CONFIG.imageConfig.preview.large.width,
        height: SITE_CONFIG.imageConfig.preview.large.height,
        alt: SITE_CONFIG.name,
      },
    ],
    locale: SITE_CONFIG.locale,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Autos usados y 0km en Santa Fe | Car Agency App",
    description:
      "Comprá o vendé tu auto en Santa Fe con Car Agency App: atención personalizada, financiación a medida y unidades usadas y 0km seleccionadas. ¡Visitános hoy!",
    images: [`${SITE_CONFIG.url}${SITE_CONFIG.previewPath}`],
    creator: SITE_CONFIG.twitterHandle,
  },
};

const landingJsonLd = {
  "@context": "https://schema.org",
  "@type": "AutoDealer",
  name: SITE_CONFIG.name,
  url: SITE_CONFIG.url,
  telephone: "+5493425281841",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Estanislao Zeballos 3556",
    addressLocality: "Santa Fe",
    addressRegion: "Santa Fe",
    addressCountry: "AR",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: 4.9,
    reviewCount: 249,
    bestRating: 5,
  },
};

export default async function LandingPage() {
  const cars = await getPublicLatestCars(9);

  return (
    <div className="bg-white antialiased selection:bg-black/95 selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(landingJsonLd),
        }}
      />
      <NavbarServer />
      <main id="main-content">
        <Hero />
        <FeatureCards />
        <LatestCarsSlider cars={cars} />
        <ServicesSection />
        <div aria-hidden="true" className="bg-background">
          <div className="mx-auto flex max-w-6xl items-center gap-5 px-4 md:px-10">
            <div className="h-0.5 flex-1 bg-zinc-300" />
            <div className="bg-secondary h-1.5 w-24 rounded-full" />
            <div className="h-0.5 flex-1 bg-zinc-300" />
          </div>
        </div>
        <Reviews />
      </main>
      <Footer />
      <WhatsAppFloatButton />
    </div>
  );
}
