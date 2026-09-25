import type { BrandWithModels, SellerOption } from "@/types/car-form";

import { useEffect, useState } from "react";

interface UseCarFormDataReturn {
  brands: BrandWithModels[];
  sellers: SellerOption[];
  loading: boolean;
}

const safeJson = async <T>(res: Response, fallback: T): Promise<T> =>
  res.ok ? res.json() : fallback;

export function useCarFormData(): UseCarFormDataReturn {
  const [brands, setBrands] = useState<BrandWithModels[]>([]);
  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [brandsRes, sellersRes] = await Promise.all([
          fetch("/api/brands", { signal: controller.signal }),
          fetch("/api/sellers", { signal: controller.signal }),
        ]);

        const [brandsData, sellersData] = await Promise.all([
          safeJson(brandsRes, []),
          safeJson(sellersRes, []),
        ]);

        if (cancelled) return;
        setBrands(brandsData);
        setSellers(sellersData);
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException)) {
          console.error("Error fetching form data:", error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return { brands, sellers, loading };
}
