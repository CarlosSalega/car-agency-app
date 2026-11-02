import { activeSite } from "@/site/active";

/**
 * `logo` is the wordmark for the expanded rail, `mark` the "GL" monogram for the
 * 3rem collapsed one.
 *
 * Both are transparent PNGs derived from `logo.png`. The source has a black field
 * baked in (87.5% of the file is empty black), so rendering it directly painted a
 * dark rectangle on the `#1c1c1c` sidebar and drew the wordmark at 8.5px tall.
 *
 * The swap uses `group-data-[collapsible=icon]`, the attribute the sidebar root
 * already exposes, so no JS state is involved. `shrink-0` plus `w-auto` is what
 * stops flex-shrink from crushing the aspect ratio: without them the 64px image
 * collapsed to 16x64, because only the main-axis size shrinks.
 */

/**
 * One height for both marks.
 *
 * The wordmark used to be `h-5` (188px wide) while the monogram was `w-8`
 * (13.7px tall): collapsing the rail made the brand visibly shrink. Sharing a
 * single token is the fix — the two cannot drift apart again while the text
 * stays complete, and 14px is the height the monogram already had.
 *
 * Measured: the wordmark is 9.4:1, so 14px tall renders 132px wide, inside the
 * 208px the 16rem rail leaves after its padding.
 */
const LOGO_HEIGHT = "h-3.5";

export const ADMIN_HEADER_CONTENT = {
  logo: {
    src: activeSite.assets.wordmark.src,
    alt: activeSite.identity.name,
    className: `${LOGO_HEIGHT} w-auto shrink-0 group-data-[collapsible=icon]:hidden`,
    width: activeSite.assets.wordmark.width,
    height: activeSite.assets.wordmark.height,
  },
  mark: {
    src: activeSite.assets.mark.src,
    alt: activeSite.identity.name,
    className: `hidden ${LOGO_HEIGHT} w-auto shrink-0 group-data-[collapsible=icon]:block`,
    width: activeSite.assets.mark.width,
    height: activeSite.assets.mark.height,
  },
  styles: {
    link: {
      base: "flex items-center gap-2 text-sm font-medium transition-colors",
      active: "text-primary",
      inactive: "text-muted-foreground hover:text-foreground",
    },
    icon: "size-4",
  },
};
