import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { CarDetailGallery, CarDetailSpecs } from "@/components/cars";

import { FALLBACK_IMAGE } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getPublicCarBySlug, getPublicCarSlugs } from "@/lib/queries";
import { SITE_CONFIG } from "@/data/metadata";

import Footer from "@/app/(landing)/components/Footer";
import { NavbarServer } from "@/app/(landing)/components/NavbarServer";
import { MetaPixelViewContent } from "@/components/ui/meta-pixel-view-content";
import { LeadForm } from "@/components/leads";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";

export const revalidate = 600;

function extractWhatsAppPhone(href: string): string {
  const param = href.match(/[?&]phone=(\d+)/);
  if (param) return param[1];
  const short = href.match(/wa\.me\/(\d+)/);
  if (short) return short[1];
  return "";
}

export async function generateStaticParams() {
  const slugs = await getPublicCarSlugs();
  return slugs.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: Pick<PageProps<"/autos/[slug]">, "params">): Promise<Metadata> {
  const { slug } = await params;

  const car = await getPublicCarBySlug(slug);

  if (!car || car.deletedAt) {
    return {
      title: "Auto no encontrado",
      description: "El vehículo que buscas no está disponible.",
    };
  }

  let images: string[] = [];

  try {
    images =
      typeof car.images === "string"
        ? JSON.parse(car.images)
        : car.images || [];
  } catch {
    images = [];
  }

  const firstImageKey = images[0];

  const firstImage = firstImageKey
    ? `${SITE_CONFIG.url}/api/images/${firstImageKey}`
    : `${SITE_CONFIG.url}${FALLBACK_IMAGE}`;

  const title = `${car.title} - ${car.brand.name} ${car.model.name}`;
  const description =
    `${car.title} ${car.year} - ${car.transmission} - ${car.fuelType} - ${car.kilometers.toLocaleString()} km. ${
      car.description || "Vehículo de calidad garantizada."
    }`.slice(0, 160);

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_CONFIG.url}/autos/${slug}`,
    },
    openGraph: {
      title,
      description,
      images: [
        {
          url: firstImage,
          width: 1200,
          height: 630,
          alt: car.title,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [firstImage],
    },
  };
}

export default async function CarDetailPage({
  params,
}: Pick<PageProps<"/autos/[slug]">, "params">) {
  const { slug } = await params;

  const car = await getPublicCarBySlug(slug);

  if (!car || car.deletedAt) {
    notFound();
  }

  let images: string[] = [];

  try {
    images =
      typeof car.images === "string"
        ? JSON.parse(car.images)
        : car.images || [];
  } catch {
    images = [];
  }

  const sellerPhoneRaw = car.seller?.phone;
  let sellerPhone = sellerPhoneRaw ? sellerPhoneRaw.replace(/\D/g, "") : "";

  if (!sellerPhone) {
    const whatsappLink = await prisma.linkTreeLink.findFirst({
      where: { isActive: true, category: "CONTACT", iconKey: "whatsapp" },
      orderBy: { sortOrder: "asc" },
      select: { href: true },
    });
    sellerPhone = extractWhatsAppPhone(
      whatsappLink?.href ?? process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? "",
    );
  }
  const carUrl = `${SITE_CONFIG.url}/autos/${car.slug}`;
  const whatsappMessage = encodeURIComponent(
    `Hola! Quiero consultar por el ${car.title}${carUrl ? `: ${carUrl}` : ""}`,
  );
  const whatsappHref = sellerPhone
    ? `https://wa.me/${sellerPhone}?text=${whatsappMessage}`
    : "";

  prisma.visit
    .create({
      data: {
        carId: car.id,
      },
    })
    .catch(() => {});

  return (
    <div className="bg-background min-h-screen">
      <NavbarServer />

      <div className="container mx-auto px-4 py-32">
        <div className="mb-12 grid gap-8 lg:grid-cols-2">
          <CarDetailGallery id={car.id} images={images} title={car.title} />
          <CarDetailSpecs car={car} />
        </div>

        <section className="border-border border-t pt-8">
          <div className="mx-auto max-w-xl">
            <LeadForm carSlug={car.slug} carTitle={car.title} />
          </div>

          {whatsappHref ? (
            <div className="mt-6 flex flex-col items-center gap-2">
              <span className="text-muted-foreground text-sm">
                o si preferís
              </span>
              <WhatsAppButton
                href={whatsappHref}
                label="Consultar por WhatsApp"
                className="hover:bg-primary/90 h-14 w-full px-8 transition-transform duration-300 hover:scale-105 sm:w-fit"
              />
            </div>
          ) : null}
        </section>
      </div>

      <Footer />

      <MetaPixelViewContent
        content_name={car.title}
        brand={car.brand.name}
        model={car.model.name}
        year={car.year}
        price={car.price}
      />
    </div>
  );
}
