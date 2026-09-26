import type { CarInput } from "@/lib/validations/car";
import type { BrandWithModels } from "@/types/car-form";
import type { Model } from "@generated/prisma/client";
import type { UseFormSetValue } from "react-hook-form";

import { useMemo, useState } from "react";

interface UseBrandModelsReturn {
  brandId: string;
  models: Model[];
  handleBrandChange: (
    brandId: string,
    setValue: UseFormSetValue<CarInput>,
  ) => void;
}

export function useBrandModels(
  brandOptions: BrandWithModels[],
  defaultBrandId?: string,
): UseBrandModelsReturn {
  const [brandId, setBrandId] = useState(defaultBrandId ?? "");
  const models = useMemo(
    () => brandOptions.find((item) => item.id === brandId)?.models ?? [],
    [brandOptions, brandId],
  );

  const handleBrandChange = (
    brandId: string,
    setValue: UseFormSetValue<CarInput>,
  ) => {
    setBrandId(brandId);
    setValue("brandId", brandId);
    setValue("modelId", "");
  };

  return {
    brandId,
    models,
    handleBrandChange,
  };
}
