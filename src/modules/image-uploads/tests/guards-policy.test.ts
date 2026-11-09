import { describe, expect, it, vi } from "vitest";

import type { Actor } from "../core/types";
import {
  evaluateAuthentication,
  evaluateDelete,
  evaluateUploadFile,
} from "../guards/policy";

const request = new Request("http://localhost/api/upload");
const actor: Actor = { id: "user-1", role: "USER" };

function makeFile(type = "image/png", content = "x"): File {
  return new File([new TextEncoder().encode(content)], "photo.png", { type });
}

describe("evaluateAuthentication", () => {
  it("returns the actor when one is resolved", async () => {
    await expect(evaluateAuthentication(request, () => actor)).resolves.toEqual(
      { ok: true, actor },
    );
  });

  it("refuses an anonymous request", async () => {
    await expect(evaluateAuthentication(request, () => null)).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    await expect(
      evaluateAuthentication(request, () => undefined),
    ).resolves.toEqual({ ok: false, code: "UNAUTHENTICATED" });
  });

  it("refuses an actor without a usable id", async () => {
    await expect(
      evaluateAuthentication(request, () => ({ id: "" })),
    ).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    await expect(
      evaluateAuthentication(request, () => ({ id: 42 as unknown as string })),
    ).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
    });
  });

  it("lets an identity-provider failure propagate as a server fault", async () => {
    await expect(
      evaluateAuthentication(request, () => {
        throw new Error("session store unreachable");
      }),
    ).rejects.toThrow("session store unreachable");
  });

  it("forwards the request to the resolver", async () => {
    const getActor = vi.fn(() => actor);

    await evaluateAuthentication(request, getActor);

    expect(getActor).toHaveBeenCalledWith(request);
  });
});

describe("evaluateUploadFile", () => {
  it("returns the accepted file", () => {
    const file = makeFile();
    const decision = evaluateUploadFile(file);

    expect(decision.ok).toBe(true);
    expect(decision.ok && decision.file).toBe(file);
  });

  it("carries the rejection code and details through", () => {
    expect(evaluateUploadFile(null)).toEqual({
      ok: false,
      code: "NO_FILE",
      details: { received: "null" },
    });
    expect(evaluateUploadFile(makeFile("application/pdf"))).toEqual({
      ok: false,
      code: "INVALID_TYPE",
      details: { type: "application/pdf", accepted: ["image/"] },
    });
    expect(
      evaluateUploadFile(makeFile("image/png", "12345"), { maxBytes: 2 }),
    ).toEqual({
      ok: false,
      code: "TOO_LARGE",
      details: { size: 5, maxBytes: 2 },
    });
  });

  it("surfaces the svg rejection identically", () => {
    expect(evaluateUploadFile(makeFile("image/svg+xml"))).toEqual({
      ok: false,
      code: "INVALID_TYPE",
      details: { type: "image/svg+xml", accepted: ["image/"] },
    });
  });
});

describe("evaluateDelete", () => {
  it("fails closed when no authorization guard is configured", async () => {
    const decision = await evaluateDelete({ request, actor, key: "cars/1" });

    expect(decision).toEqual({
      ok: false,
      code: "FORBIDDEN",
      details: { cause: "authorizeDelete is not configured" },
    });
    expect("reason" in decision).toBe(false);
  });

  it("allows when the guard allows", async () => {
    await expect(
      evaluateDelete({
        request,
        actor,
        key: "cars/1",
        authorizeDelete: () => ({ allowed: true }),
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("forwards role and ownership data to the guard", async () => {
    const authorizeDelete = vi.fn(() => ({ allowed: true as const }));

    await evaluateDelete({ request, actor, key: "cars/1", authorizeDelete });

    expect(authorizeDelete).toHaveBeenCalledWith({
      request,
      actor,
      key: "cars/1",
    });
  });

  it("returns the reason so the adapter can pick the right string", async () => {
    await expect(
      evaluateDelete({
        request,
        actor,
        key: "cars/1",
        authorizeDelete: () => ({ allowed: false, reason: "NOT_OWNED" }),
      }),
    ).resolves.toEqual({ ok: false, code: "FORBIDDEN", reason: "NOT_OWNED" });

    await expect(
      evaluateDelete({
        request,
        actor,
        key: "cars/1",
        authorizeDelete: async () => ({
          allowed: false,
          reason: "OTHER_OWNER",
        }),
      }),
    ).resolves.toEqual({ ok: false, code: "FORBIDDEN", reason: "OTHER_OWNER" });
  });

  it("lets the guard supply its own message", async () => {
    await expect(
      evaluateDelete({
        request,
        actor,
        key: "cars/1",
        authorizeDelete: () => ({
          allowed: false,
          reason: "OTHER_OWNER",
          message: "Not your listing",
        }),
      }),
    ).resolves.toEqual({
      ok: false,
      code: "FORBIDDEN",
      reason: "OTHER_OWNER",
      message: "Not your listing",
    });
  });

  it("denies without inventing a reason when the guard gives none", async () => {
    const decision = await evaluateDelete({
      request,
      actor,
      key: "cars/1",
      authorizeDelete: () => ({ allowed: false }),
    });

    expect(decision).toEqual({ ok: false, code: "FORBIDDEN" });
    expect("reason" in decision).toBe(false);
  });

  it("denies instead of crashing when the guard throws", async () => {
    await expect(
      evaluateDelete({
        request,
        actor,
        key: "cars/1",
        authorizeDelete: () => {
          throw new Error("database down");
        },
      }),
    ).resolves.toEqual({
      ok: false,
      code: "FORBIDDEN",
      details: { error: "database down" },
    });
  });
});
