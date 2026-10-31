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
  title: "Autos usados y 0km en Santa Fe | GL Autos",
  description:
    "Comprá o vendé tu auto en Santa Fe con GL Autos: atención personalizada, financiación a medida y unidades usadas y 0km seleccionadas. ¡Visitános hoy!",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Autos usados y 0km en Santa Fe | GL Autos",
    description:
      "Comprá o vendé tu auto en Santa Fe con GL Autos: atención personalizada, financiación a medida y unidades usadas y 0km seleccionadas. ¡Visitános hoy!",
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
    title: "Autos usados y 0km en Santa Fe | GL Autos",
    description:
      "Comprá o vendé tu auto en Santa Fe con GL Autos: atención personalizada, financiación a medida y unidades usadas y 0km seleccionadas. ¡Visitános hoy!",
    images: [`${SITE_CONFIG.url}${SITE_CONFIG.previewPath}`],
  },
};

const landingJsonLd = {
  "@context": "https://schema.org",
  "@type": "AutoDealer",
  name: SITE_CONFIG.name,
  url: SITE_CONFIG.url,
  telephone: "+5493425777646",
  description: "Concesionario multimarcas de usados seleccionados y 0km",
  address: {
    "@type": "PostalAddress",
    streetAddress: "General López 3543",
    addressLocality: "Santa Fe",
    addressRegion: "Santa Fe",
    addressCountry: "AR",
  },
  hasMap:
    "https://www.google.com/maps/place/GL+Autos/@-31.6552097,-60.7221098,17z/data=!3m1!4b1!4m6!3m5!1s0x95b5a98297abae09:0xbc2d98ddab36bb27!8m2!3d-31.6552097!4d-60.7221098!16s%2Fg%2F11ww7df7k8",
  geo: {
    "@type": "GeoCoordinates",
    latitude: -31.6552097,
    longitude: -60.7221098,
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "08:30",
      closes: "12:30",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "16:00",
      closes: "20:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Saturday",
      opens: "09:00",
      closes: "12:30",
    },
  ],
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
    <div className="bg-background text-foreground selection:bg-primary selection:text-primary-foreground antialiased">
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
            <div className="bg-border h-0.5 flex-1" />
            <div className="bg-primary h-1.5 w-24 rounded-full" />
            <div className="bg-border h-0.5 flex-1" />
          </div>
        </div>
        <Reviews />
      </main>
      <Footer />
      <WhatsAppFloatButton />
    </div>
  );
}
