"use client";

import type {
  Brand,
  LinkTreeLink,
  Model,
  Seller,
} from "@generated/prisma/client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BrandsConfig } from "./brands-config";
import { LinkTreeLinksConfig } from "./linktree/links-config";
import { ModelsConfig } from "./models-config";
import { SellersConfig } from "./sellers-config";

type BrandWithModels = Brand & {
  models: Model[];
};

interface ConfigTabsProps {
  initialBrands: BrandWithModels[];
  initialSellers: Seller[];
  initialLinkTreeLinks: LinkTreeLink[];
  initialTab: "brands" | "models" | "sellers" | "linktree";
  currentPage: number;
}

export function ConfigTabs({
  initialBrands,
  initialSellers,
  initialLinkTreeLinks,
  initialTab,
  currentPage,
}: ConfigTabsProps) {
  const router = useRouter();

  const [brands, setBrands] = useState<BrandWithModels[]>(initialBrands);
  const [sellers, setSellers] = useState<Seller[]>(initialSellers);
  const [linkTreeLinks, setLinkTreeLinks] =
    useState<LinkTreeLink[]>(initialLinkTreeLinks);
  const [tab, setTab] = useState<"brands" | "models" | "sellers" | "linktree">(
    initialTab,
  );

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  function handleTabChange(value: string) {
    const nextTab =
      value === "models"
        ? "models"
        : value === "sellers"
          ? "sellers"
          : value === "linktree"
            ? "linktree"
            : "brands";
    setTab(nextTab);
    router.push(`/admin/config?tab=${nextTab}&page=1`);
  }

  return (
    <Tabs value={tab} onValueChange={handleTabChange} dir="ltr">
      <TabsList className="bg-card grid h-24 grid-cols-2 px-4 shadow-lg/30 sm:grid-cols-4">
        <TabsTrigger className="h-10" value="brands">
          Marcas
        </TabsTrigger>
        <TabsTrigger className="h-10" value="models">
          Modelos
        </TabsTrigger>
        <TabsTrigger className="h-10" value="sellers">
          Vendedores
        </TabsTrigger>
        <TabsTrigger className="h-10" value="linktree">
          Contacto
        </TabsTrigger>
      </TabsList>

      <TabsContent value="brands" className="mt-6">
        <BrandsConfig
          brands={brands}
          onBrandsChange={setBrands}
          currentPage={currentPage}
          baseUrl="/admin/config?tab=brands"
        />
      </TabsContent>

      <TabsContent value="models" className="mt-6">
        <ModelsConfig
          brands={brands}
          currentPage={currentPage}
          baseUrl="/admin/config?tab=models"
        />
      </TabsContent>

      <TabsContent value="sellers" className="mt-6">
        <SellersConfig
          sellers={sellers}
          onSellersChange={setSellers}
          currentPage={currentPage}
          baseUrl="/admin/config?tab=sellers"
        />
      </TabsContent>

      <TabsContent value="linktree" className="mt-6 space-y-8">
        <div className="space-y-3">
          <LinkTreeLinksConfig
            category="CONTACT"
            links={linkTreeLinks}
            onLinksChange={setLinkTreeLinks}
            currentPage={currentPage}
            baseUrl="/admin/config?tab=linktree"
          />
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Redes</h3>
          <LinkTreeLinksConfig
            category="SOCIAL"
            links={linkTreeLinks}
            onLinksChange={setLinkTreeLinks}
            currentPage={currentPage}
            baseUrl="/admin/config?tab=linktree"
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
