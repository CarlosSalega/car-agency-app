export const DEFAULT_IMAGE_FALLBACK = "/placeholder.webp";

export const CLOUD_NAME_PLACEHOLDER = "${CLOUD_NAME}";

export const CLOUDINARY_CLOUD_NAME_PLACEHOLDER =
  "${NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}";

export const DEFAULT_VARIANTS = {
  thumbnail: "w_300,h_225,c_fill,f_auto,q_auto,dpr_auto",
  card: "w_400,h_300,c_fill,f_auto,q_auto,dpr_auto",
  detail: "w_800,h_600,c_fill,f_auto,q_auto,dpr_auto",
  fullscreen: "w_2400,h_1800,c_limit,f_auto,q_auto,dpr_auto",
} as const;

export type VariantMap = Record<string, string>;

export interface ImageUrlConfig<
  V extends VariantMap = typeof DEFAULT_VARIANTS,
> {
  readonly base?: string;

  readonly cloudName?: string;

  readonly fallback?: string;

  readonly variants?: V;

  readonly defaultVariant?: Extract<keyof V, string>;

  readonly variantPlacement?: "segment" | "none";

  readonly stripExtension?: boolean;
}

export interface ImageUrlResolver<
  V extends VariantMap = typeof DEFAULT_VARIANTS,
> {
  readonly variants: V;
  resolve(key: string, variant?: Extract<keyof V, string>): string;
}

export function createImageUrlResolver<
  V extends VariantMap = typeof DEFAULT_VARIANTS,
>(config: ImageUrlConfig<V> = {}): ImageUrlResolver<V> {
  const variants = config.variants ?? (DEFAULT_VARIANTS as unknown as V);
  const fallback = config.fallback ?? DEFAULT_IMAGE_FALLBACK;
  const base = config.base;
  const cloudName = config.cloudName;
  const variantPlacement = config.variantPlacement ?? "segment";
  const stripExtension = config.stripExtension ?? true;
  const defaultVariant =
    config.defaultVariant ??
    (Object.keys(variants)[0] as Extract<keyof V, string> | undefined);

  const templated =
    base !== undefined &&
    (base.includes(CLOUD_NAME_PLACEHOLDER) ||
      base.includes(CLOUDINARY_CLOUD_NAME_PLACEHOLDER));

  function resolve(key: string, variant?: Extract<keyof V, string>): string {
    if (!key || !base) return fallback;
    if (templated && !cloudName) return fallback;

    const resolvedBase = (
      cloudName === undefined ? base : substituteCloudName(base, cloudName)
    ).replace(/\/+$/, "");
    const resolvedKey = stripExtension ? key.replace(/\.webp$/, "") : key;

    if (variantPlacement === "none") {
      return `${resolvedBase}/${resolvedKey}`;
    }

    const chosenKey = variant ?? defaultVariant;
    const transform = chosenKey === undefined ? undefined : variants[chosenKey];
    if (!transform) return fallback;

    return `${resolvedBase}/${transform}/${resolvedKey}`;
  }

  return { variants, resolve };
}

function substituteCloudName(base: string, cloudName: string): string {
  return base
    .split(CLOUDINARY_CLOUD_NAME_PLACEHOLDER)
    .join(cloudName)
    .split(CLOUD_NAME_PLACEHOLDER)
    .join(cloudName);
}

export interface PublicIdOptions {
  readonly fallback?: string;

  readonly host?: string;

  readonly afterSegment?: string | null;

  readonly stripVersion?: boolean;

  readonly stripExtension?: boolean;
}

export function getPublicIdFromUrl(
  url: string,
  options: PublicIdOptions = {},
): string {
  const fallback = options.fallback ?? "placeholder";
  const host = options.host ?? "res.cloudinary.com";
  const afterSegment =
    options.afterSegment === undefined ? "upload" : options.afterSegment;
  const stripVersion = options.stripVersion ?? true;
  const stripExtension = options.stripExtension ?? true;

  if (!url || !url.includes(host)) return fallback;

  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);

    let keyPath: string;

    if (afterSegment === null) {
      keyPath = parts.join("/");
    } else {
      const markerIndex = parts.indexOf(afterSegment);

      if (markerIndex === -1 || markerIndex >= parts.length - 1)
        return fallback;

      keyPath = parts.slice(markerIndex + 1).join("/");
    }

    if (stripVersion) {
      const versionMatch = keyPath.match(/^v\d+\/(.+)$/);

      if (versionMatch?.[1] !== undefined) keyPath = versionMatch[1];
    }

    const publicId = stripExtension ? keyPath.replace(/\.[^.]+$/, "") : keyPath;

    return publicId || fallback;
  } catch {
    return fallback;
  }
}
