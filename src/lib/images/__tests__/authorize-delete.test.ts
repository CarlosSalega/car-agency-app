import { describe, expect, it, vi } from "vitest";

import { createAuthorizeDelete } from "../authorize-delete";

const KEY = "car-agency-app/asset";

const seller = { id: "seller-1", role: "USER" } as const;
const otherSeller = { id: "seller-2", role: "USER" } as const;
const admin = { id: "admin-1", role: "ADMIN" } as const;

function deps(
  cars: readonly { userId: string | null }[],
  upload: { userId: string } | null,
) {
  return {
    findCarsUsingKey: vi.fn(async () => cars),
    findUploadByKey: vi.fn(async () => upload),
  };
}

describe("createAuthorizeDelete", () => {
  it("allows an ADMIN when a car uses the key", async () => {
    const injected = deps([{ userId: otherSeller.id }], null);
    const authorize = createAuthorizeDelete(injected);

    await expect(authorize({ key: KEY, actor: admin })).resolves.toEqual({
      allowed: true,
    });
    expect(injected.findCarsUsingKey).toHaveBeenCalledWith(KEY);
  });

  it("allows the owner of a car that uses the key", async () => {
    const injected = deps(
      [{ userId: otherSeller.id }, { userId: seller.id }],
      null,
    );
    const authorize = createAuthorizeDelete(injected);

    await expect(authorize({ key: KEY, actor: seller })).resolves.toEqual({
      allowed: true,
    });
  });

  it("denies another seller's car with OTHER_OWNER", async () => {
    const injected = deps([{ userId: otherSeller.id }], null);
    const authorize = createAuthorizeDelete(injected);

    await expect(authorize({ key: KEY, actor: seller })).resolves.toEqual({
      allowed: false,
      reason: "OTHER_OWNER",
    });
  });

  it("denies the uploader when another user's car uses the key", async () => {
    const injected = deps([{ userId: otherSeller.id }], { userId: seller.id });
    const authorize = createAuthorizeDelete(injected);

    await expect(authorize({ key: KEY, actor: seller })).resolves.toEqual({
      allowed: false,
      reason: "OTHER_OWNER",
    });
  });

  it("allows an ADMIN when no car uses the key, without reading the upload", async () => {
    const injected = deps([], { userId: seller.id });
    const authorize = createAuthorizeDelete(injected);

    await expect(authorize({ key: KEY, actor: admin })).resolves.toEqual({
      allowed: true,
    });
    expect(injected.findUploadByKey).not.toHaveBeenCalled();
  });

  it("allows the uploader when no car uses the key", async () => {
    const injected = deps([], { userId: seller.id });
    const authorize = createAuthorizeDelete(injected);

    await expect(authorize({ key: KEY, actor: seller })).resolves.toEqual({
      allowed: true,
    });
    expect(injected.findUploadByKey).toHaveBeenCalledWith(KEY);
  });

  it("denies another uploader's orphan with OTHER_OWNER", async () => {
    const injected = deps([], { userId: otherSeller.id });
    const authorize = createAuthorizeDelete(injected);

    await expect(authorize({ key: KEY, actor: seller })).resolves.toEqual({
      allowed: false,
      reason: "OTHER_OWNER",
    });
  });

  it("denies a key with no car and no upload with NOT_OWNED", async () => {
    const injected = deps([], null);
    const authorize = createAuthorizeDelete(injected);

    await expect(authorize({ key: KEY, actor: seller })).resolves.toEqual({
      allowed: false,
      reason: "NOT_OWNED",
    });
  });
});
