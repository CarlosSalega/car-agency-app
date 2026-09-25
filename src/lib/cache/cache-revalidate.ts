import { revalidateTag } from "next/cache";

import { CACHE_TAGS } from "@/lib/cache";

export function revalidateCars() {
  revalidateTag(CACHE_TAGS.CARS);
}

export function revalidateCar(id: string) {
  revalidateTag(CACHE_TAGS.CAR(id));
}

export function revalidateBrands() {
  revalidateTag(CACHE_TAGS.BRANDS);
}

export function revalidateModels() {
  revalidateTag(CACHE_TAGS.MODELS);
}

export function revalidateSellers() {
  revalidateTag(CACHE_TAGS.SELLERS);
}
