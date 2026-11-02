import { composeSite } from "../compose";
import type { SiteTheme } from "../contract";

import { assets, identity } from "./identity";
import { seo } from "./seo";

/**
 * GL Autos, as one object.
 *
 * The theme values are duplicated here on purpose: CSS cannot import TypeScript,
 * so `theme.css` feeds the stylesheet and this object feeds anything that needs
 * the value at runtime (the admin's `themeColor`, a generated image). A test pins
 * the two together, because a divergence would be invisible until somebody
 * compared the tab colour with the sidebar.
 */
const theme: SiteTheme = {
  brand: "#fe0000",
  brandForeground: "#000000",
};

export const glautos = composeSite({
  id: "glautos",
  identity,
  theme,
  seo,
  assets,
});
