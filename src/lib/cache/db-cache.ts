export const CACHE_REVALIDATE = {
  CARS_LIST: 60 * 5,
  CAR_DETAIL: 60 * 10,
  STATIC_DATA: 60 * 60,
  DYNAMIC_DATA: 60,
  IMAGES: 60 * 60 * 24 * 7,
} as const;

export const CACHE_TAGS = {
  CARS: "cars",
  CAR: (id: string) => `car-${id}`,
  BRANDS: "brands",
  MODELS: "models",
  SELLERS: "sellers",
  REVIEWS: "reviews",
  IMAGES: "images",
} as const;
