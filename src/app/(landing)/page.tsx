import type { Metadata } from "next";

import { activeSite } from "@/site/active";
import { buildPageMetadata } from "@/site/contract";
import { getPublicLatestCars } from "@/lib/queries/cars";

import FeatureCards from "./components/FeatureCards";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import { LatestCarsSlider } from "./components/LatestCarsSlider";
import { NavbarServer } from "./components/NavbarServer";
import Reviews from "./components/Reviews";
import ServicesSection from "./components/ServicesSection";
import { WhatsAppFloatButton } from "./components/ui/WhatsAppFloatButton";

export const metadata: Metadata = buildPageMetadata(activeSite, "home", "/");
const landingJsonLd = {
  "@context": "https://schema.org",
  "@type": "AutoDealer",
  name: activeSite.identity.name,
  url: activeSite.url,
  telephone: activeSite.identity.contact.phoneRaw,
  description: activeSite.identity.dealerDescription,
  address: {
    "@type": "PostalAddress",
    streetAddress: activeSite.identity.address.street,
    addressLocality: activeSite.identity.address.locality,
    addressRegion: activeSite.identity.address.region,
    addressCountry: activeSite.identity.address.country,
  },
  hasMap: activeSite.identity.mapsUrl,
  geo: {
    "@type": "GeoCoordinates",
    latitude: activeSite.identity.geo.latitude,
    longitude: activeSite.identity.geo.longitude,
  },
  openingHoursSpecification: activeSite.identity.hours.map((window) => ({
    "@type": "OpeningHoursSpecification",
    // One day stays a string, several are an array: both shapes were published
    // before this refactor and the markup is not the place to change them.
    dayOfWeek: window.days.length === 1 ? window.days[0] : window.days,
    opens: window.opens,
    closes: window.closes,
  })),
  // No `aggregateRating`. Self-published ratings for a LocalBusiness are not
  // allowed by Google's structured data policy, and the 4.9/249 that used to be
  // here had no verifiable source behind it. It comes back in T4.1, wired to
  // real reviews, not typed in by hand.
};

export default async function LandingPage() {
  const cars = await getPublicLatestCars(9);

  return (
    <div className="bg-background text-foreground selection:bg-brand selection:text-brand-foreground antialiased">
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
            <div className="bg-brand h-1.5 w-24 rounded-full" />
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
