import { describe, expect, it, vi } from "vitest";

import { prismaSafe } from "@/lib/prisma-safe";

describe("prismaSafe", () => {
  it("retries a message-classified connection failure and succeeds", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("Can't reach database server"))
      .mockResolvedValue("success");

    await expect(prismaSafe(operation, { retries: 1, delay: 0 })).resolves.toBe(
      "success",
    );
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("rethrows a non-connection error without retrying", async () => {
    const error = new Error("Invalid query");
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(error);

    await expect(prismaSafe(operation, { retries: 3, delay: 0 })).rejects.toBe(
      error,
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("propagates the error after retries are exhausted", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error("Connection terminated"));

    await expect(
      prismaSafe(operation, { retries: 2, delay: 0 }),
    ).rejects.toThrow("Connection terminated");
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
