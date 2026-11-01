import { redirect } from "next/navigation";

import Link from "next/link";

import { ConfigTabs } from "@/components/config-tabs";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ConfigPage({
  searchParams,
}: PageProps<"/admin/config">) {
  const params = await searchParams;
  const tab =
    params?.tab === "models"
      ? "models"
      : params?.tab === "sellers"
        ? "sellers"
        : params?.tab === "linktree" ||
            params?.tab === "contact" ||
            params?.tab === "social"
          ? "linktree"
          : "brands";
  const currentPage = Number(params?.page) || 1;
  const session = await requireAuthSession();

  if (session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  const [brands, sellers, linkTreeLinks] = await Promise.all([
    prisma.brand.findMany({
      orderBy: { name: "asc" },
      include: {
        models: {
          orderBy: { name: "asc" },
        },
      },
    }),
    prisma.seller.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.linkTreeLink.findMany({
      orderBy: [
        { category: "asc" },
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
    }),
  ]);

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6">
        {/* The ML integration lives on its own page: it is a server-rendered
            status card, not editable state, so it does not belong inside the
            client tabs. */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            Datos de la agencia, catálogo y enlaces públicos.
          </p>
          <Button
            variant="outline"
            render={<Link href="/admin/config/mercadolibre" />}
          >
            Mercado Libre
          </Button>
        </div>
        <ConfigTabs
          initialBrands={brands}
          initialSellers={sellers}
          initialLinkTreeLinks={linkTreeLinks}
          initialTab={tab}
          currentPage={currentPage}
        />
      </div>
    </div>
  );
}
