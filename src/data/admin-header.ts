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
export const ADMIN_HEADER_CONTENT = {
  logo: {
    src: "/logo-wordmark.png",
    alt: "GL Autos",
    // 179x19 is 9.4:1: at h-5 (20px) the mark is 188px wide, which fits the
    // 224px the 16rem rail leaves after its padding. h-7 would ask for 264px.
    className: "h-5 w-auto shrink-0 group-data-[collapsible=icon]:hidden",
    width: 179,
    height: 19,
  },
  mark: {
    src: "/logo-mark.png",
    alt: "GL Autos",
    className: "hidden h-auto w-8 shrink-0 group-data-[collapsible=icon]:block",
    width: 42,
    height: 18,
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
