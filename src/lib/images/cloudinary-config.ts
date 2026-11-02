import { activeSite } from "@/site/active";

export const CLOUDINARY_UPLOAD_OPTIONS = {
  folder: "car-agency-app",
  resource_type: "image" as const,

  quality: "auto" as const,
  fetch_format: "auto" as const,

  eager: [
    {
      width: 400,
      height: 300,
      crop: "fill" as const,
      gravity: "auto" as const,
      quality: "auto" as const,
      fetch_format: "auto" as const,
      flags: ["progressive"],
    },
  ],

  overwrite: false,
  invalidate: true,

  // The dealership name is the tag an operator filters by in the Cloudinary
  // console, so it is client data. This is the one direction where the product
  // reads the active site: an integration may use its labels, and must not
  // branch its behaviour on which client it is.
  tags: [activeSite.identity.name, "vehicle"],
};

export const CLOUDINARY_RESPONSIVE_TRANSFORMS =
  "w_auto,dpr_auto,f_auto,q_auto,c_scale";

export const CLOUDINARY_SIZES = {
  thumbnail: {
    width: 300,
    height: 225,
  },
  mobile: {
    width: 400,
    height: 300,
  },
  tablet: {
    width: 600,
    height: 450,
  },
  desktop: {
    width: 800,
    height: 600,
  },
  fullscreen: {
    width: 1200,
    height: 900,
  },
};
