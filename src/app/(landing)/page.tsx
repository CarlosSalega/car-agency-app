import type { Metadata } from "next";

import { activeSite } from "@/site/active";
import { buildPageMetadata } from "@/site/contract";
import { getSession } from "@/lib/auth";
import { getPublicCarsCount, getPublicLatestCars } from "@/lib/queries/cars";
import {
  getPublishedReviewSummary,
  getPublishedReviews,
} from "@/lib/queries/reviews";
import { withReviewStructuredData } from "@/lib/reviews";

import Footer from "./components/Footer";
import { Hero } from "./components/Hero";
import { LatestArrivals } from "./components/LatestArrivals";
import { AppraisalSection } from "./components/AppraisalSection";
import { PaymentRoutes } from "./components/PaymentRoutes";
import { Salon } from "./components/Salon";
import { WhyUs } from "./components/WhyUs";
import { SiteHeader } from "./components/SiteHeader";
import Reviews from "./components/Reviews";
import { WhatsAppFloatButton } from "./components/ui/WhatsAppFloatButton";

export const metadata: Metadata = buildPageMetadata(activeSite, "home", "/");

/**
 * Everything but the reviews. The `aggregateRating` and the `review` list are
 * attached at request time from the published rows, so the markup can never drift
 * from what the section below it renders — and every dealer field comes from the
 * active site, never from a literal in this file.
 */
const dealerJsonLd = {
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
  // No `aggregateRating` and no `review` here: both are added by
  // `withReviewStructuredData` below, from the published rows only. Self-published
  // ratings for a LocalBusiness are not allowed by Google's structured data
  // policy, and the 4.9/249 that used to live here had no verifiable source.
};

export default async function LandingPage() {
  const [cars, totalCars, reviews, reviewSummary, session] = await Promise.all([
    getPublicLatestCars(9),
    getPublicCarsCount({}),
    getPublishedReviews(),
    getPublishedReviewSummary(),
    getSession(),
  ]);

  const landingJsonLd = withReviewStructuredData(dealerJsonLd, {
    summary: reviewSummary,
    reviews,
  });

  return (
    <div className="bg-background text-foreground selection:bg-brand selection:text-brand-foreground antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(landingJsonLd),
        }}
      />
      <SiteHeader />
      <main id="main-content">
        <Hero totalCars={totalCars} />
        <LatestArrivals cars={cars} totalCars={totalCars} />
        <WhyUs />
        <PaymentRoutes />
        <AppraisalSection />
        <Reviews />
        <Salon />
      </main>
      <Footer session={session?.user ?? null} />
      <WhatsAppFloatButton />
    </div>
  );
}
