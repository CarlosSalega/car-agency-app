import { activeSite } from "@/site/active";

export const HEADER_CONTENT = {
  logo: {
    // Transparent wordmark, trimmed to the artwork. The full `logo.png` carries
    // the black field it was exported on, which reads as a pasted rectangle on
    // any surface that is not pure black.
    src: activeSite.assets.wordmark.src,
    alt: activeSite.identity.name,
    // 9.4:1 lockup: h-6 is 226px wide, which still leaves room for the
    // menu button on a 375px viewport.
    className: "h-6 w-auto shrink-0 sm:h-8",
    width: 179,
    height: 19,
  },
  brand: {
    text: activeSite.identity.name,
    className: "font-bold text-foreground uppercase hidden md:block",
  },
  api: {
    authEndpoint: "/api/auth/get-session",
  },
};
