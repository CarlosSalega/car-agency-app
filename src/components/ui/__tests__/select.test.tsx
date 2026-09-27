import { describe, expect, it } from "vitest";

import { resolveAlignItemWithTrigger } from "@/components/ui/select";

/**
 * These two assertions are the whole point of this file.
 *
 * The bug they pin was an inverted boolean next to a doc comment that confidently
 * stated the wrong mapping. Every `Select` in the project then opened a popup
 * showing one option and an empty white box, because `alignItemWithTrigger`
 * being wrongly `true` makes Base UI stretch the popup while pinning the list to
 * the trigger's height.
 *
 * A DOM-level test cannot catch that: the options are always rendered, and the
 * defect is CSS clipping. jsdom has no layout engine. So the guard targets the
 * mapping itself, not the symptom.
 */
describe("resolveAlignItemWithTrigger", () => {
  it('maps Radix position="popper" to alignItemWithTrigger=false', () => {
    // The project default. `false` is what restores the pre-migration look and
    // keeps `side` / `sideOffset` active.
    expect(resolveAlignItemWithTrigger("popper")).toBe(false);
  });

  it('maps position="item-aligned" to alignItemWithTrigger=true', () => {
    expect(resolveAlignItemWithTrigger("item-aligned")).toBe(true);
  });
});
