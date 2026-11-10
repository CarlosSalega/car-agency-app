import { beforeEach, describe, expect, it } from "vitest";

import {
  ATTRIBUTION_STORAGE_KEY,
  MAX_ATTRIBUTION_LENGTH,
  captureFirstTouch,
  cleanAttributionValue,
  compactAttribution,
  isEmptyAttribution,
  mergeFirstTouch,
  parseAttribution,
  readAttribution,
} from "../attribution";

describe("cleanAttributionValue", () => {
  it("trims, collapses whitespace and drops control characters", () => {
    expect(cleanAttributionValue("  instagram \n\t feed  ")).toBe(
      "instagram feed",
    );
    expect(cleanAttributionValue("a\u0000b")).toBe("a b");
  });

  it("treats a blank value as absent", () => {
    expect(cleanAttributionValue("   ")).toBeUndefined();
    expect(cleanAttributionValue(null)).toBeUndefined();
    expect(cleanAttributionValue(undefined)).toBeUndefined();
  });

  it("caps the length, because the value comes from a URL a stranger controls", () => {
    const long = "x".repeat(MAX_ATTRIBUTION_LENGTH + 50);

    expect(cleanAttributionValue(long)).toHaveLength(MAX_ATTRIBUTION_LENGTH);
  });
});

describe("parseAttribution", () => {
  it("reads the three campaign parameters it cares about", () => {
    const search =
      "?utm_source=instagram&utm_medium=cpc&utm_campaign=hilux-octubre";

    expect(parseAttribution(search, null)).toEqual({
      utmSource: "instagram",
      utmMedium: "cpc",
      utmCampaign: "hilux-octubre",
    });
  });

  it("ignores parameters it does not model, including utm_content and utm_term", () => {
    const attribution = parseAttribution(
      "?utm_source=meta&utm_content=video-a&utm_term=usados&fbclid=abc123",
      null,
    );

    expect(attribution).toEqual({ utmSource: "meta" });
  });

  it("keeps an external referrer as host plus path", () => {
    expect(
      parseAttribution("", "https://l.instagram.com/stories/marca/123?x=1"),
    ).toEqual({ referrer: "l.instagram.com/stories/marca/123" });
  });

  it("drops our own host, because internal navigation is not a source", () => {
    expect(
      parseAttribution(
        "",
        "http://localhost:3000/autos/taos",
        "localhost:3000",
      ),
    ).toEqual({});
  });

  it("drops a referrer that is not an http URL", () => {
    expect(parseAttribution("", "android-app://com.instagram.android")).toEqual(
      {},
    );
    expect(parseAttribution("", "not a url")).toEqual({});
  });

  it("survives an empty query string", () => {
    expect(parseAttribution("", null)).toEqual({});
  });
});

describe("mergeFirstTouch", () => {
  it("keeps the stored campaign when a later visit has none", () => {
    const merged = mergeFirstTouch(
      { utmSource: "instagram", utmCampaign: "hilux-octubre" },
      {},
    );

    expect(merged).toMatchObject({
      utmSource: "instagram",
      utmCampaign: "hilux-octubre",
    });
  });

  it("fills the gaps from the newer visit", () => {
    const merged = mergeFirstTouch(
      { utmSource: "instagram" },
      { utmMedium: "cpc" },
    );

    expect(merged).toMatchObject({ utmSource: "instagram", utmMedium: "cpc" });
  });

  it("never lets a newer value overwrite a stored one", () => {
    const merged = mergeFirstTouch(
      { utmSource: "instagram" },
      { utmSource: "facebook" },
    );

    expect(merged.utmSource).toBe("instagram");
  });
});

describe("isEmptyAttribution", () => {
  it("is true for nothing and for only-empty fields", () => {
    expect(isEmptyAttribution({})).toBe(true);
    expect(isEmptyAttribution(null)).toBe(true);
    expect(isEmptyAttribution({ utmSource: undefined })).toBe(true);
  });

  it("is false as soon as one field carries a value", () => {
    expect(isEmptyAttribution({ utmCampaign: "x" })).toBe(false);
  });
});

describe("compactAttribution", () => {
  it("drops empty fields and normalises the rest", () => {
    expect(
      compactAttribution({
        utmSource: "  meta ",
        utmMedium: "",
        referrer: undefined,
      }),
    ).toEqual({ utmSource: "meta" });
  });
});

describe("browser capture", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  function landOn(search: string) {
    window.history.replaceState({}, "", `/autos/taos${search}`);
  }

  it("persists the first touch and reuses it on a later page without UTMs", () => {
    landOn("?utm_source=instagram&utm_campaign=hilux");
    expect(captureFirstTouch()).toEqual({
      utmSource: "instagram",
      utmCampaign: "hilux",
    });

    // A later navigation drops the query string; the campaign must survive.
    landOn("");
    expect(readAttribution()).toEqual({
      utmSource: "instagram",
      utmCampaign: "hilux",
    });
  });

  it("does not overwrite a stored campaign with a newer one", () => {
    landOn("?utm_source=instagram");
    captureFirstTouch();

    landOn("?utm_source=facebook&utm_medium=cpc");
    captureFirstTouch();

    expect(readAttribution()).toMatchObject({
      utmSource: "instagram",
      utmMedium: "cpc",
    });
  });

  it("survives a corrupted stored value", () => {
    landOn("?utm_source=instagram");
    window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, "{not json");

    expect(readAttribution()).toEqual({ utmSource: "instagram" });
  });

  it("ignores an internal referrer coming from the browser", () => {
    landOn("");

    expect(readAttribution()).toEqual({});
  });
});
