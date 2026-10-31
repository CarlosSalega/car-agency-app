import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  DESTRUCTIVE_TABLES,
  SEED_ENV_OVERRIDE,
  decideSeedAllowed,
  seedRefusalMessage,
} from "../guard";

describe("seed guard", () => {
  it("allows a plain local run, where NODE_ENV is unset", () => {
    // `tsx prisma/seed.ts` does not set NODE_ENV, so this is the documented
    // `pnpm db:seed` flow and it must keep working.
    expect(decideSeedAllowed({})).toEqual({ allowed: true, overridden: false });
  });

  it.each(["development", "test"])("allows NODE_ENV=%s", (nodeEnv) => {
    expect(decideSeedAllowed({ NODE_ENV: nodeEnv }).allowed).toBe(true);
  });

  it("blocks NODE_ENV=production", () => {
    const decision = decideSeedAllowed({ NODE_ENV: "production" });

    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toContain("NODE_ENV");
  });

  it.each(["production", "preview"])(
    "blocks a Vercel %s deployment, because it points at a real database too",
    (vercelEnv) => {
      const decision = decideSeedAllowed({
        NODE_ENV: "production",
        VERCEL_ENV: vercelEnv,
      });

      expect(decision.allowed).toBe(false);
    },
  );

  it("allows `vercel dev`, which reports development", () => {
    expect(
      decideSeedAllowed({ NODE_ENV: "development", VERCEL_ENV: "development" })
        .allowed,
    ).toBe(true);
  });

  it.each(["1", "true", "YES", " 1 "])(
    "accepts %s as an explicit override, even in production",
    (value) => {
      expect(
        decideSeedAllowed({
          NODE_ENV: "production",
          SEED_ALLOW_DESTRUCTIVE: value,
        }),
      ).toEqual({ allowed: true, overridden: true });
    },
  );

  it.each(["", "0", "false", "no"])(
    "does not treat %s as an override",
    (value) => {
      expect(
        decideSeedAllowed({
          NODE_ENV: "production",
          SEED_ALLOW_DESTRUCTIVE: value,
        }).allowed,
      ).toBe(false);
    },
  );

  it("names the override variable in the refusal message", () => {
    expect(seedRefusalMessage('NODE_ENV is "production"')).toContain(
      `${SEED_ENV_OVERRIDE}=1`,
    );
  });

  it("keeps the advertised table list in sync with what resetDatabase empties", () => {
    // The message the operator reads is only honest if it matches the code.
    const source = fs.readFileSync(
      path.resolve(__dirname, "../repositories.ts"),
      "utf8",
    );
    const emptied = [...source.matchAll(/prisma\.(\w+)\.deleteMany\(\)/g)].map(
      (match) => match[1],
    );

    expect(emptied.length).toBeGreaterThan(0);
    expect([...DESTRUCTIVE_TABLES].sort()).toEqual([...emptied].sort());
  });
});
