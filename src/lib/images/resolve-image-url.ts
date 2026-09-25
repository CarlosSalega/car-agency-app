import { FALLBACK_IMAGE } from "@/lib/constants";

const VARIANTS = {
  thumbnail: "w_300,h_225,c_fill,f_auto,q_auto,dpr_auto",
  card: "w_400,h_300,c_fill,f_auto,q_auto,dpr_auto",
  detail: "w_800,h_600,c_fill,f_auto,q_auto,dpr_auto",
  fullscreen: "w_2400,h_1800,c_limit,f_auto,q_auto,dpr_auto",
};

export function resolveImageUrl(
  key: string,
  variant: keyof typeof VARIANTS = "card",
) {
  const base = process.env.NEXT_PUBLIC_IMAGE_CDN;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  if (!key || !cloudName || !base) return FALLBACK_IMAGE;

  const transform = VARIANTS[variant];
  const cleanKey = key.replace(/\.webp$/, "");

  return `${base.replace("${NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}", cloudName)}/${transform}/${cleanKey}`;
}
