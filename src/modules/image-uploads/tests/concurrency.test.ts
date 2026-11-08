import { describe, expect, it, vi } from "vitest";

import { mapWithConcurrency } from "../core/concurrency";

const tick = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("mapWithConcurrency", () => {
  it("keeps results in input order when work finishes out of order", async () => {
    const items = [30, 10, 20, 5];
    const indices: number[] = [];

    const results = await mapWithConcurrency(items, 4, async (delay, index) => {
      indices.push(index);
      await tick(delay);
      return `done-${delay}`;
    });

    expect(results).toEqual(["done-30", "done-10", "done-20", "done-5"]);
    expect(indices).toEqual([0, 1, 2, 3]);
  });

  it("never runs more workers than the limit", async () => {
    let inFlight = 0;
    let peak = 0;

    const results = await mapWithConcurrency(
      Array.from({ length: 12 }, (_, index) => index),
      3,
      async (item) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await tick(3);
        inFlight -= 1;
        return item * 2;
      },
    );

    expect(peak).toBe(3);
    expect(results).toHaveLength(12);
    expect(results[0]).toBe(0);
    expect(results[11]).toBe(22);
  });

  it("runs everything when the limit exceeds the item count", async () => {
    let inFlight = 0;
    let peak = 0;

    const results = await mapWithConcurrency([1, 2, 3], 50, async (item) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await tick(3);
      inFlight -= 1;
      return item;
    });

    expect(peak).toBe(3);
    expect(results).toEqual([1, 2, 3]);
  });

  it.each([0, -3, Number.NaN])(
    "treats a limit of %s as a single worker",
    async (limit) => {
      let inFlight = 0;
      let peak = 0;

      const results = await mapWithConcurrency(
        [1, 2, 3],
        limit,
        async (item) => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await tick(2);
          inFlight -= 1;
          return item;
        },
      );

      expect(peak).toBe(1);
      expect(results).toEqual([1, 2, 3]);
    },
  );

  it("resolves an empty list without calling the worker", async () => {
    const worker = vi.fn(async (item: number) => item);

    await expect(mapWithConcurrency([], 4, worker)).resolves.toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });

  it("rejects the whole call with the worker error", async () => {
    const failure = new Error("worker exploded");

    await expect(
      mapWithConcurrency([1, 2, 3, 4], 2, async (item) => {
        if (item === 2) throw failure;
        await tick(1);
        return item;
      }),
    ).rejects.toBe(failure);
  });
});
