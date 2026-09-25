import { redirect } from "next/navigation";

import { ConfigTabs } from "@/components/config-tabs";
import { prisma } from "@/lib/db";
import { requireAuthSession } from "@/lib/auth";

interface ConfigPageProps {
  searchParams: {
    tab?: string;
    page?: string;
  };
}

export const dynamic = "force-dynamic";

export default async function ConfigPage({ searchParams }: ConfigPageProps) {
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
