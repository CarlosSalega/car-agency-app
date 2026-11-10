import { composeSite } from "../compose";
import type { SiteTheme } from "../contract";

import { assets, identity } from "./identity";
import { seo } from "./seo";

/**
 * The demo client, as one object.
 *
 * The theme values are duplicated between `theme.css` and this object because CSS
 * cannot import TypeScript: the stylesheet feeds the page, this feeds anything
 * that needs the colour at runtime (the admin's tab colour, a generated image). A
 * test pins the two together.
 */
const theme: SiteTheme = {
  brand: "#6ea8fe",
  brandForeground: "#121212",
};

export const demo = composeSite({
  id: "demo",
  identity,
  theme,
  seo,
  assets,
});
