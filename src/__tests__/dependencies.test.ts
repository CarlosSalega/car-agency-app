import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every dependency is pinned to an exact version on purpose.
 *
 * A caret range means two machines can install different code from the same
 * commit, and it means a transitive patch release can change behaviour without
 * a review. `pnpm-lock.yaml` narrows that in practice, but the lockfile is not
 * committed on every checkout of every branch and it is not what a reviewer
 * reads when they look at `package.json`.
 *
 * This test exists because the file had drifted: 15 specs carried `^` or a
 * major-only range, and a partly pinned manifest is the worst of both worlds,
 * because it looks disciplined while still floating.
 */
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * The single exception: a module that is not published to a registry yet is
 * consumed from a path or a git ref. This is not a range in disguise — a git
 * spec carries the commit, and a path spec is the working copy itself — but it
 * still deserves a narrow door, so the test below pins the exact set. A second
 * local dependency cannot slip in without someone editing that list.
 */
const LOCAL_SPEC = /^(?:file|link|workspace|github):/;

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf8"),
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const SECTIONS = ["dependencies", "devDependencies"] as const;

describe("package.json dependency pinning", () => {
  it("pins every dependency to an exact version", () => {
    const unpinned: string[] = [];

    for (const section of SECTIONS) {
      for (const [name, spec] of Object.entries(packageJson[section] ?? {})) {
        if (!EXACT_VERSION.test(spec) && !LOCAL_SPEC.test(spec))
          unpinned.push(`${section}: ${name}@${spec}`);
      }
    }

    expect(unpinned).toEqual([]);
  });

  it("allows a local or git specifier only for the modules that are not published", () => {
    const localSpecs = SECTIONS.flatMap((section) =>
      Object.entries(packageJson[section] ?? {})
        .filter(([, spec]) => LOCAL_SPEC.test(spec))
        .map(([name, spec]) => `${name}@${spec}`),
    );

    expect(localSpecs).toEqual([
      "image-uploads@file:../../modules/image-uploads",
    ]);
  });

  it("finds the dependencies at all, so the sweep cannot pass vacuously", () => {
    const count = SECTIONS.reduce(
      (total, section) =>
        total + Object.keys(packageJson[section] ?? {}).length,
      0,
    );

    expect(count).toBeGreaterThan(10);
  });
});
