import { execFile } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  applySync,
  inspectSync,
  isPreservedPath,
  planSync,
} from "@/lib/deploy/sync-deployment";

/**
 * Two layers, because they prove different things.
 *
 * The plan is pure, so its rules are pinned here without a repository: a
 * deployment with a client package, one without, a path that only the product
 * has, one that only the deployment has, and the seam paths that must never be
 * called product-owned.
 *
 * The sync itself writes to another repository, so it is exercised against two
 * temporary git repositories created with `mkdtemp`. That is the only place
 * where "kept every preserved path byte for byte" and "the new commit's parent
 * is the old HEAD" can be observed at all: a path list says what a plan intends,
 * not what a commit did.
 */

const GIT_MAX_BUFFER = 16 * 1024 * 1024;
const GIT_TIMEOUT_MS = 60_000;

const created: string[] = [];

afterEach(async () => {
  for (const directory of created.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function scratch(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  created.push(directory);
  return directory;
}

/** The product's v1 tree: what a deployment last received. */
const PRODUCT_V1: Record<string, string> = {
  "package.json": '{\n  "name": "product"\n}\n',
  "README.md": "# the product's readme\n",
  "src/app/page.tsx": "export const version = 1;\n",
  "src/lib/thing.ts": "export const thing = 1;\n",
  "src/lib/legacy.ts": "export const legacy = true;\n",
  "src/site/active.ts": "export const activeSite = demo;\n",
  "src/site/compose.ts": "export const compose = true;\n",
  "src/site/contract.ts": "export interface SiteDefinition { id: string }\n",
  "src/site/deployment.ts": "export const LOCAL_ORIGIN = 'x';\n",
  "src/site/registry.ts":
    'import { demo } from "./demo";\n\nexport const sites = { demo };\n',
  "src/site/theme.css": '@import "./demo/theme.css";\n',
  "src/site/seed.ts": 'export { demoSeed as seedData } from "./demo/seed";\n',
  "src/site/demo/index.ts": 'export const demo = { id: "demo" };\n',
  "src/site/__tests__/brand-leak.test.ts": "export const guard = true;\n",
};

/** The product's changes since the deployment was last synced. */
const PRODUCT_V2: Record<string, string> = {
  "src/app/page.tsx": "export const version = 2;\n",
  "src/lib/thing.ts": "export const thing = 2;\n",
  "src/lib/new.ts": "export const added = true;\n",
  "src/site/demo/seed.ts": "export const demoSeed = { cars: [] };\n",
};

const PRODUCT_V2_DELETED = ["README.md", "src/lib/legacy.ts"];

/** The deployment's own surface: a client package, its seams and its photos. */
const DEPLOYMENT_SURFACE: Record<string, string> = {
  "src/site/acme/index.ts": 'export const acme = { id: "acme" };\n',
  "src/site/acme/identity.ts": 'export const name = "Agencia de prueba";\n',
  "src/site/acme/theme.css": ":root { --brand: #123456; }\n",
  "src/site/acme/seed/index.ts": "export const acmeSeed = { cars: [] };\n",
  "src/site/acme/seed/cars.ts": "export const cars = [];\n",
  "src/site/registry.ts":
    'import { acme } from "./acme";\n\nexport const sites = { acme };\n',
  "src/site/theme.css": '@import "./acme/theme.css";\n',
  "src/site/seed.ts": 'export { acmeSeed as seedData } from "./acme/seed";\n',
};

const PRODUCT_LOGO = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02]);
const DEPLOYMENT_LOGO = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0xaa, 0xbb]);
const DEPLOYMENT_PHOTO = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x0c, 0x00, 0x00, 0x00, 0xfe, 0x7f,
]);

function execGit(cwd: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["-C", cwd, ...args],
      {
        encoding: "utf8",
        maxBuffer: GIT_MAX_BUFFER,
        timeout: GIT_TIMEOUT_MS,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve(stdout.trim());
          return;
        }
        reject(
          new Error(
            `git ${args.join(" ")} failed in ${cwd}: ${stderr || error.message}`,
          ),
        );
      },
    );
  });
}

async function writeFiles(
  root: string,
  files: Record<string, string | Buffer>,
): Promise<void> {
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, ...relative.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

/**
 * A repository with an identity of its own and no inherited hooks.
 *
 * `core.hooksPath` points at an empty directory so a developer's global pre-commit
 * hook cannot run here and make the suite pass or fail for the wrong reason; the
 * identity is local because the product's user config is none of a test's business.
 */
async function initRepository(name: string, hooks: string): Promise<string> {
  const directory = await scratch(`sync-${name}-`);
  await execGit(directory, ["init", "--quiet"]);
  await execGit(directory, ["symbolic-ref", "HEAD", "refs/heads/main"]);
  await execGit(directory, ["config", "user.name", "Sync Test"]);
  await execGit(directory, ["config", "user.email", "sync@example.test"]);
  await execGit(directory, ["config", "commit.gpgsign", "false"]);
  await execGit(directory, ["config", "core.hooksPath", hooks]);
  return directory;
}

async function commitAll(root: string, message: string): Promise<string> {
  await execGit(root, ["add", "--all"]);
  await execGit(root, ["commit", "--quiet", "--no-verify", "-m", message]);
  return execGit(root, ["rev-parse", "HEAD"]);
}

interface Fixture {
  readonly product: string;
  readonly deployment: string;
  /** The bare repository the deployment's origin points at. */
  readonly origin: string;
  readonly productHead: string;
  readonly deploymentHead: string;
  /** The deployment's own bytes, captured before the sync runs. */
  readonly preservedBytes: ReadonlyMap<string, Buffer>;
}

/**
 * A product that has moved ahead, and a deployment last synced to its v1 tree.
 *
 * The deployment is a real repository with a real `origin` behind it, because
 * refusing to sync into a repository whose origin is missing is a guard, and
 * because "nothing was pushed" is only observable with somewhere to push to.
 */
async function fixture(): Promise<Fixture> {
  const hooks = await scratch("sync-hooks-");
  const product = await initRepository("product", hooks);
  const deployment = await initRepository("deployment", hooks);
  const origin = await scratch("sync-origin-");

  await execGit(origin, ["init", "--quiet", "--bare"]);

  await writeFiles(product, {
    ...PRODUCT_V1,
    "public/logo.png": PRODUCT_LOGO,
  });
  const productV1 = await commitAll(product, "product v1");

  await writeFiles(deployment, {
    ...PRODUCT_V1,
    ...DEPLOYMENT_SURFACE,
    "public/logo.png": DEPLOYMENT_LOGO,
    "public/autos/photo-1.webp": DEPLOYMENT_PHOTO,
  });
  const deploymentHead = await commitAll(
    deployment,
    "deployment as last synced",
  );

  await execGit(deployment, ["remote", "add", "origin", origin]);
  await execGit(deployment, ["push", "--quiet", "origin", "main"]);

  expect(await execGit(origin, ["rev-parse", "main"])).toBe(deploymentHead);

  await writeFiles(product, PRODUCT_V2);
  for (const relative of PRODUCT_V2_DELETED) {
    await execGit(product, ["rm", "--quiet", relative]);
  }
  const productHead = await commitAll(product, "product v2");

  expect(productV1).not.toBe(productHead);

  const preservedBytes = new Map<string, Buffer>();
  for (const relative of Object.keys(DEPLOYMENT_SURFACE)) {
    preservedBytes.set(
      relative,
      await readFile(path.join(deployment, ...relative.split("/"))),
    );
  }
  for (const relative of ["public/logo.png", "public/autos/photo-1.webp"]) {
    preservedBytes.set(
      relative,
      await readFile(path.join(deployment, ...relative.split("/"))),
    );
  }

  return {
    product,
    deployment,
    origin,
    productHead,
    deploymentHead,
    preservedBytes,
  };
}

describe("planSync", () => {
  const productTree = [
    ...Object.keys(PRODUCT_V1),
    "public/logo.png",
    "src/lib/new.ts",
  ];

  it("derives the client package from the deployment's src/site/ directory", () => {
    const plan = planSync({
      productTree,
      deploymentTree: [
        ...Object.keys(PRODUCT_V1),
        ...Object.keys(DEPLOYMENT_SURFACE),
        "public/logo.png",
        "public/autos/photo-1.webp",
      ],
    });

    expect(plan.clientPackages).toEqual(["acme"]);
    expect(plan.preserved).toEqual(
      [
        ...Object.keys(DEPLOYMENT_SURFACE),
        "public/autos/photo-1.webp",
        "public/logo.png",
      ].sort(),
    );
  });

  it("works for a deployment that ships no extra client package", () => {
    const plan = planSync({
      productTree,
      deploymentTree: [...Object.keys(PRODUCT_V1), "public/logo.png"],
    });

    expect(plan.clientPackages).toEqual([]);
    expect(plan.missingSeams).toEqual([]);
    expect(plan.preserved).toEqual(
      [
        "public/logo.png",
        "src/site/registry.ts",
        "src/site/seed.ts",
        "src/site/theme.css",
      ].sort(),
    );
  });

  it("reports a deployment with no seed seam instead of failing", () => {
    const deploymentWithoutSeed = [
      ...Object.keys(PRODUCT_V1).filter(
        (entry) => entry !== "src/site/seed.ts",
      ),
      "public/logo.png",
    ];

    const plan = planSync({
      productTree,
      deploymentTree: deploymentWithoutSeed,
    });

    expect(plan.missingSeams).toEqual(["src/site/seed.ts"]);
    expect(plan.preserved).not.toContain("src/site/seed.ts");
    expect(plan.added).not.toContain("src/site/seed.ts");
  });

  it("reports a deployment with no public/ directory instead of failing", () => {
    const plan = planSync({
      productTree,
      deploymentTree: Object.keys(PRODUCT_V1),
    });

    expect(plan.missingSeams).toEqual(["public"]);
  });

  it("adds a path only the product has", () => {
    const plan = planSync({
      productTree,
      deploymentTree: [...Object.keys(PRODUCT_V1), "public/logo.png"],
    });

    expect(plan.added).toEqual(["src/lib/new.ts"]);
  });

  it("removes a path only the deployment has, unless the deployment owns it", () => {
    const plan = planSync({
      productTree,
      deploymentTree: [
        ...Object.keys(PRODUCT_V1),
        "src/site/__tests__/old-guard.test.ts",
        "scripts/old-sync.ts",
        "public/brand/photo.webp",
      ],
    });

    expect(plan.removed).toEqual([
      "scripts/old-sync.ts",
      "src/site/__tests__/old-guard.test.ts",
    ]);
  });

  it("takes a path both trees carry from the product", () => {
    const plan = planSync({
      productTree,
      deploymentTree: [...Object.keys(PRODUCT_V1), "public/logo.png"],
    });

    expect(plan.fromProduct).toContain("src/app/page.tsx");
    expect(plan.fromProduct).toContain("src/site/demo/index.ts");
  });

  it("never calls public/ or a seam file product-owned", () => {
    const productOwned = [
      ...planSync({
        productTree,
        deploymentTree: [
          ...Object.keys(PRODUCT_V1),
          ...Object.keys(DEPLOYMENT_SURFACE),
          "public/autos/photo-1.webp",
        ],
      }).fromProduct,
      ...planSync({ productTree, deploymentTree: [] }).added,
    ];

    expect(productOwned).not.toContain("public/logo.png");
    expect(productOwned).not.toContain("src/site/registry.ts");
    expect(productOwned).not.toContain("src/site/theme.css");
    expect(productOwned).not.toContain("src/site/seed.ts");
  });

  it("always keeps the product's own seam files product-owned", () => {
    const plan = planSync({
      productTree,
      deploymentTree: [
        ...Object.keys(PRODUCT_V1),
        ...Object.keys(DEPLOYMENT_SURFACE),
      ],
    });
    const productOwned = [...plan.fromProduct, ...plan.added];

    for (const entry of [
      "src/site/active.ts",
      "src/site/contract.ts",
      "src/site/compose.ts",
      "src/site/deployment.ts",
      "src/site/__tests__/brand-leak.test.ts",
      "src/site/demo/index.ts",
    ]) {
      expect(productOwned).toContain(entry);
      expect(plan.preserved).not.toContain(entry);
    }
  });

  it("classifies paths by shape, not by a list of clients", () => {
    expect(
      isPreservedPath("src/site/some-client-nobody-registered/theme.css"),
    ).toBe(true);
    expect(isPreservedPath("src/site/demo/theme.css")).toBe(false);
    expect(isPreservedPath("src/site/__tests__/brand-leak.test.ts")).toBe(
      false,
    );
    expect(isPreservedPath("src/site/theme.css")).toBe(true);
    expect(isPreservedPath("public/autos/photo-1.webp")).toBe(true);
  });

  it("ignores duplicates, backslashes and a leading ./", () => {
    const plan = planSync({
      productTree: ["./src/lib/new.ts", "src/lib/new.ts", "src\\lib\\other.ts"],
      deploymentTree: [],
    });

    expect(plan.added).toEqual(["src/lib/new.ts", "src/lib/other.ts"]);
  });

  it("never puts a preserved path in the sets the sync writes", () => {
    const plan = planSync({
      productTree,
      deploymentTree: [
        ...Object.keys(PRODUCT_V1),
        ...Object.keys(DEPLOYMENT_SURFACE),
      ],
    });
    const written = new Set([
      ...plan.added,
      ...plan.fromProduct,
      ...plan.removed,
    ]);

    for (const entry of plan.preserved) {
      expect(written.has(entry)).toBe(false);
    }
  });
});

describe("applySync on two temporary repositories", () => {
  it("takes the product's changes, keeps the deployment's surface byte for byte, and commits on top of HEAD", async () => {
    const {
      product,
      deployment,
      origin,
      productHead,
      deploymentHead,
      preservedBytes,
    } = await fixture();

    const result = await applySync({
      productPath: product,
      deploymentPath: deployment,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    // The deployment received what the product changed, added and deleted.
    expect(result.modified).toContain("src/app/page.tsx");
    expect(result.added).toContain("src/lib/new.ts");
    expect(result.deleted).toContain("src/lib/legacy.ts");
    expect(result.deleted).toContain("README.md");

    expect(
      await readFile(path.join(deployment, "src/app/page.tsx"), "utf8"),
    ).toBe(PRODUCT_V2["src/app/page.tsx"]);
    expect(
      await readFile(path.join(deployment, "src/site/demo/seed.ts"), "utf8"),
    ).toBe(PRODUCT_V2["src/site/demo/seed.ts"]);
    expect(
      await readFile(path.join(deployment, "src/lib/new.ts"), "utf8"),
    ).toBe(PRODUCT_V2["src/lib/new.ts"]);

    await expect(
      stat(path.join(deployment, "src/lib/legacy.ts")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      stat(path.join(deployment, "README.md")),
    ).rejects.toMatchObject({ code: "ENOENT" });

    // Every preserved path is the deployment's own, byte for byte.
    for (const [relative, before] of preservedBytes) {
      const after = await readFile(
        path.join(deployment, ...relative.split("/")),
      );
      expect(after.equals(before), `${relative} changed during the sync`).toBe(
        true,
      );
      expect(result.preserved).toContain(relative);
    }

    // The product's copy of a preserved path did not land: the deployment's
    // logo is its own, not the product's neutral one.
    expect(
      (await readFile(path.join(deployment, "public/logo.png"))).equals(
        DEPLOYMENT_LOGO,
      ),
    ).toBe(true);
    expect(
      (await readFile(path.join(deployment, "public/logo.png"))).equals(
        PRODUCT_LOGO,
      ),
    ).toBe(false);

    // The sync's own commit names the product commit and sits on the old HEAD.
    expect(result.commit).not.toBeNull();
    const commit = result.commit;
    if (commit === null) throw new Error("expected a commit");

    expect(await execGit(deployment, ["rev-parse", "HEAD"])).toBe(commit.sha);
    expect(await execGit(deployment, ["rev-parse", "HEAD^"])).toBe(
      deploymentHead,
    );
    expect(commit.parent).toBe(deploymentHead);
    expect(commit.message).toContain(productHead);
    expect(commit.productCommit).toBe(productHead);

    // Nothing was pushed, and the product was only read.
    expect(await execGit(origin, ["rev-parse", "main"])).toBe(deploymentHead);
    expect(await execGit(product, ["rev-parse", "HEAD"])).toBe(productHead);
    expect(await execGit(product, ["status", "--porcelain"])).toBe("");
  });

  it("creates no commit when the deployment already matches the product", async () => {
    const { product, deployment, deploymentHead } = await fixture();

    const first = await applySync({
      productPath: product,
      deploymentPath: deployment,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.reason);

    const syncedHead = await execGit(deployment, ["rev-parse", "HEAD"]);
    expect(syncedHead).not.toBe(deploymentHead);

    const second = await applySync({
      productPath: product,
      deploymentPath: deployment,
    });

    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error(second.reason);

    expect(second.commit).toBeNull();
    expect(await execGit(deployment, ["rev-parse", "HEAD"])).toBe(syncedHead);
    expect(await execGit(deployment, ["status", "--porcelain"])).toBe("");
  });

  it("refuses when the deployment has uncommitted changes", async () => {
    const { product, deployment, deploymentHead } = await fixture();
    await writeFile(
      path.join(deployment, "src/site/acme/identity.ts"),
      "draft\n",
    );

    const result = await applySync({
      productPath: product,
      deploymentPath: deployment,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a refusal");

    expect(result.code).toBe("dirty-working-tree");
    expect(result.reason).toContain("deployment repository");
    expect(await execGit(deployment, ["rev-parse", "HEAD"])).toBe(
      deploymentHead,
    );
  });

  it("refuses when the product has uncommitted changes", async () => {
    const { product, deployment, productHead } = await fixture();
    await writeFile(path.join(product, "src/lib/thing.ts"), "draft\n");

    const result = await applySync({
      productPath: product,
      deploymentPath: deployment,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a refusal");

    expect(result.code).toBe("dirty-working-tree");
    expect(result.reason).toContain("product repository");
    expect(await execGit(product, ["rev-parse", "HEAD"])).toBe(productHead);
  });

  it("refuses when the deployment has no origin", async () => {
    const { product, deployment, deploymentHead } = await fixture();
    await execGit(deployment, ["remote", "remove", "origin"]);

    const result = await applySync({
      productPath: product,
      deploymentPath: deployment,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a refusal");

    expect(result.code).toBe("missing-origin");
    expect(await execGit(deployment, ["rev-parse", "HEAD"])).toBe(
      deploymentHead,
    );
  });

  it("refuses when the deployment path is a subdirectory of a repository", async () => {
    const { product, deployment, deploymentHead } = await fixture();

    const result = await inspectSync({
      productPath: product,
      deploymentPath: path.join(deployment, "src", "site"),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a refusal");

    expect(result.code).toBe("not-a-repository-root");
    expect(await execGit(deployment, ["rev-parse", "HEAD"])).toBe(
      deploymentHead,
    );
  });

  it("reports the plan without writing anything", async () => {
    const { product, deployment, deploymentHead } = await fixture();

    const inspection = await inspectSync({
      productPath: product,
      deploymentPath: deployment,
    });

    expect(inspection.ok).toBe(true);
    if (!inspection.ok) throw new Error(inspection.reason);

    expect(inspection.plan.clientPackages).toEqual(["acme"]);
    expect(inspection.plan.added).toContain("src/lib/new.ts");
    expect(inspection.plan.removed).toContain("README.md");
    expect(await execGit(deployment, ["rev-parse", "HEAD"])).toBe(
      deploymentHead,
    );
    expect(await execGit(deployment, ["status", "--porcelain"])).toBe("");
  });
});
