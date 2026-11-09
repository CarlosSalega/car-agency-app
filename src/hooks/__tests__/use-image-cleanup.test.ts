import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useImageCleanup } from "@/hooks/use-image-cleanup";

const KEYS = Array.from({ length: 10 }, (_, index) => `cars/${index}.webp`);

// `Car.images` stores the Cloudinary `public_id`, and so must every delete.
const STORAGE_KEY = "car-agency-app/titctbi7xrdxqwwfqrqh";
const DELIVERY_URL = `https://res.cloudinary.com/demo/image/upload/v1712345678/${STORAGE_KEY}.webp`;
const TRANSFORMED_URL = `https://res.cloudinary.com/demo/image/upload/w_400,h_300,c_fill,f_auto,q_auto,dpr_auto/${STORAGE_KEY}.webp`;
const UNDERIVABLE_URL = `https://res.cloudinary.com/demo/image/fetch/${STORAGE_KEY}.webp`;

const ok = () => ({ ok: true, json: async () => ({}) });

// The route reads the storage key from `key` (`keyField ?? "key"`), so that is
// the only field these tests may assert on.
const requestBody = (init: RequestInit) =>
  JSON.parse(String(init.body)) as { key?: string };

const deletedKey = (init: RequestInit) => requestBody(init).key as string;

// Deleting is fire-and-forget, so a test can finish with requests still queued.
// Only the stub installed by the running test records anything; a leftover
// request from the previous test gets a resolved response and is not counted.
let activeStub: symbol | null = null;

/** Counts overlapping deletes and records every request the hook makes. */
function stubFetch(
  respond: (key: string) => Promise<unknown> = async () => ok(),
) {
  const token = Symbol("fetch-stub");
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let inFlight = 0;
  const peak = { current: 0 };

  activeStub = token;

  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    if (activeStub !== token) return Promise.resolve(ok());

    calls.push({ url, init });

    inFlight += 1;
    peak.current = Math.max(peak.current, inFlight);

    return respond(deletedKey(init)).finally(() => {
      inFlight -= 1;
    });
  });

  vi.stubGlobal("fetch", fetchMock);

  return { calls, fetchMock, peak };
}

/**
 * The hook deletes the temporary uploads when the page unloads, so the test
 * triggers the same path the browser does.
 */
function unload() {
  act(() => {
    window.dispatchEvent(new Event("beforeunload"));
  });
}

const requestedKeys = (calls: Array<{ init: RequestInit }>) =>
  calls.map((call) => deletedKey(call.init));

/** Lets a fire-and-forget delete reach the stubbed `fetch` before asserting. */
const settle = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

afterEach(() => {
  activeStub = null;
  vi.unstubAllGlobals();
});

describe("useImageCleanup deletes", () => {
  it("keeps at most four deletes in flight at once", async () => {
    const { fetchMock, peak, calls } = stubFetch(
      () => new Promise((resolve) => setTimeout(() => resolve(ok()), 5)),
    );

    const view = renderHook(() => useImageCleanup());

    act(() => {
      view.result.current.setTempUploaded(KEYS);
    });

    unload();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(KEYS.length));

    expect(peak.current).toBe(4);
    expect(calls.map((call) => deletedKey(call.init))).toEqual(KEYS);
  });

  it("keeps deleting after a single delete fails", async () => {
    const { fetchMock, calls } = stubFetch(async (key) => {
      if (key === "cars/3.webp") throw new Error("delete failed");
      return ok();
    });

    const view = renderHook(() => useImageCleanup());

    act(() => {
      view.result.current.setTempUploaded(KEYS);
    });

    unload();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(KEYS.length));

    expect(calls.map((call) => deletedKey(call.init))).toEqual(KEYS);
  });

  it("sends DELETE /api/upload with the key", async () => {
    const { fetchMock, calls } = stubFetch();

    const view = renderHook(() => useImageCleanup());

    act(() => {
      view.result.current.setTempUploaded(["cars/a.webp"]);
    });

    unload();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(calls[0].url).toBe("/api/upload");
    expect(calls[0].init.method).toBe("DELETE");
    expect(calls[0].init.headers).toEqual({
      "Content-Type": "application/json",
    });
    expect(requestBody(calls[0].init)).toEqual({
      key: "cars/a.webp",
    });
  });

  it("makes no request at all for an empty list", async () => {
    const { fetchMock } = stubFetch();

    const view = renderHook(() => useImageCleanup());

    act(() => {
      view.result.current.cleanupUsedImages([]);
    });

    unload();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useImageCleanup derives the key of a URL", () => {
  it("sends the derived public_id for a Cloudinary delivery URL", async () => {
    const { fetchMock, calls } = stubFetch();

    const view = renderHook(() => useImageCleanup());

    act(() => {
      view.result.current.setTempUploaded([DELIVERY_URL]);
    });

    unload();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Version segment and `.webp` extension are not part of `Car.images`.
    expect(requestBody(calls[0].init)).toEqual({ key: STORAGE_KEY });
  });

  it("forwards a bare key unchanged", async () => {
    const { fetchMock, calls } = stubFetch();

    const view = renderHook(() => useImageCleanup());

    act(() => {
      view.result.current.setTempUploaded([STORAGE_KEY]);
    });

    unload();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(requestBody(calls[0].init)).toEqual({ key: STORAGE_KEY });
  });

  it("sends nothing when the key cannot be derived", async () => {
    const { fetchMock, calls } = stubFetch();

    const view = renderHook(() => useImageCleanup());

    act(() => {
      view.result.current.setTempUploaded([UNDERIVABLE_URL]);
    });

    unload();
    await settle();

    // `getPublicIdFromUrl` answers its `placeholder` fallback here; sending it
    // would only produce a 403, so the item is skipped instead of guessed.
    expect(calls).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never guesses the key of a URL that carries a transformation segment", async () => {
    const { fetchMock, calls } = stubFetch();

    const view = renderHook(() => useImageCleanup());

    act(() => {
      view.result.current.setTempUploaded([TRANSFORMED_URL]);
    });

    unload();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // The derivation keeps the leading variant segment, so the request names a
    // key no car lists: the server answers 403 and nothing is deleted. That is
    // the fail-safe direction — the alternative would be deleting a guessed
    // key that may belong to another seller — so this test pins the behaviour
    // instead of asking for a heuristic.
    expect(requestBody(calls[0].init)).toEqual({
      key: `w_400,h_300,c_fill,f_auto,q_auto,dpr_auto/${STORAGE_KEY}`,
    });
    expect(deletedKey(calls[0].init)).not.toBe(STORAGE_KEY);
  });
});

describe("useImageCleanup used-image cleanup", () => {
  it("deletes the uploaded-but-unsaved image and keeps the used ones", async () => {
    const { fetchMock, calls } = stubFetch();

    const view = renderHook(() => useImageCleanup());

    act(() => {
      view.result.current.setTempUploaded([
        "cars/saved.webp",
        "cars/orphan.webp",
      ]);
    });

    act(() => {
      view.result.current.cleanupUsedImages(["cars/saved.webp"]);
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(requestedKeys(calls)).toEqual(["cars/orphan.webp"]);
    expect(view.result.current.tempUploaded).toEqual([]);
  });

  it("does not delete a used image when the component unmounts", async () => {
    const { fetchMock, calls } = stubFetch();

    const view = renderHook(() => useImageCleanup());

    act(() => {
      view.result.current.setTempUploaded([
        "cars/saved.webp",
        "cars/orphan.webp",
      ]);
    });

    act(() => {
      view.result.current.cleanupUsedImages(["cars/saved.webp"]);
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    view.unmount();
    await settle();

    // Unmounting re-reads the latest temporary list, which no longer holds the
    // saved key, so the saved image is requested exactly zero times.
    expect(requestedKeys(calls)).toEqual(["cars/orphan.webp"]);
  });

  it("does not delete a saved image when the temporary list changes", async () => {
    const { fetchMock, calls } = stubFetch();

    const view = renderHook(() => useImageCleanup());

    act(() => {
      view.result.current.setTempUploaded(["cars/saved.webp"]);
    });

    // A state change re-renders the hook; it must never be read as "everything
    // in the previous list is now unused".
    act(() => {
      view.result.current.setTempUploaded(["cars/saved.webp", "cars/new.webp"]);
    });

    await settle();

    expect(calls).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
