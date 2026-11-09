import "dotenv/config";

import type { KeyRing } from "@/lib/integrations/token-crypto";

/**
 * Re-seals channel credentials under the current key version.
 *
 * D2's rotation path is: add `v2` to `TOKEN_ENCRYPTION_KEYS`, run this, then
 * remove `v1`. The version is stored per record precisely so a payload sealed
 * with `v1` is still readable while this runs — the script reads with the
 * record's version and writes with the highest one.
 *
 * Dry run is the default: nothing is written without `--confirm`, because the
 * refresh token is single-use and a careless run is the last thing you want
 * between you and a reconnect.
 *
 * Tokens and keys never reach stdout or stderr. The report is account ids, key
 * versions and counts.
 */

const USAGE = `Usage: pnpm rotate:tokens [options]

Re-seals every ChannelAccount token with the highest version listed in
TOKEN_ENCRYPTION_KEYS. Dry run by default — nothing is written without
--confirm.

Rotation: add the new key as a higher version, run this with --confirm, then
remove the old version from the environment.

Options:
  --confirm                 Rewrite the outdated rows. Without this flag the
                            script only reports how many rows are outdated.
  --help                    Print this message and exit 0.
`;

interface ParsedOptions {
  readonly confirm: boolean;
}

type ParsedArgs =
  | { readonly kind: "help" }
  | { readonly kind: "options"; readonly options: ParsedOptions }
  | { readonly kind: "error"; readonly message: string };

/** An expected failure: printed as one readable line, without a stack trace. */
class RotationFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RotationFailure";
  }
}

interface AccountRow {
  readonly id: string;
  readonly accessToken: string;
  readonly refreshToken: string;
}

interface AccountVersions {
  readonly id: string;
  readonly accessVersion: number | null;
  readonly refreshVersion: number | null;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let confirm = false;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { kind: "help" };

    if (arg === "--confirm") {
      confirm = true;
      continue;
    }

    if (arg.startsWith("-")) {
      return { kind: "error", message: `Unknown option: ${arg}` };
    }

    return { kind: "error", message: `Unexpected argument: ${arg}` };
  }

  return { kind: "options", options: { confirm } };
}

async function main(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv);

  if (parsed.kind === "help") {
    process.stdout.write(USAGE);
    return 0;
  }

  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n\n${USAGE}`);
    return 2;
  }

  try {
    return await run(parsed.options);
  } catch (error) {
    if (error instanceof RotationFailure) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }

    process.stderr.write(
      `The rotation failed unexpectedly: ${describeError(error)}\n`,
    );
    return 1;
  }
}

async function run(options: ParsedOptions): Promise<number> {
  // Imported lazily: the crypto module is cheap but `@/lib/db` builds a Prisma
  // client while it is evaluated, and `--help` must work with no environment.
  const {
    KeyRingError,
    decryptToken,
    encryptToken,
    loadKeyRing,
    readPayloadVersion,
  } = await import("@/lib/integrations/token-crypto");

  let ring: KeyRing;
  try {
    ring = loadKeyRing(process.env);
  } catch (error) {
    if (error instanceof KeyRingError) throw new RotationFailure(error.message);

    throw error;
  }

  const { prisma } = await openDatabase();

  try {
    const accounts: AccountRow[] = await prisma.channelAccount.findMany({
      select: { id: true, accessToken: true, refreshToken: true },
      orderBy: { createdAt: "asc" },
    });

    const versions: AccountVersions[] = accounts.map((account) => ({
      id: account.id,
      accessVersion: readPayloadVersion(account.accessToken),
      refreshVersion: readPayloadVersion(account.refreshToken),
    }));

    const outdated = versions.filter(
      (account) =>
        account.accessVersion !== ring.currentVersion ||
        account.refreshVersion !== ring.currentVersion,
    );
    const unreadable = outdated.filter(
      (account) =>
        account.accessVersion === null || account.refreshVersion === null,
    );

    process.stdout.write(
      [
        `Current key version: v${ring.currentVersion}`,
        `Readable versions: ${formatVersions([...ring.keys.keys()])}`,
        `Accounts: ${accounts.length}`,
        `Outdated: ${outdated.length}`,
        `Unreadable payloads: ${unreadable.length}`,
      ].join("\n") + "\n",
    );

    if (unreadable.length > 0) {
      process.stderr.write(
        `Some rows do not hold a versioned payload (${unreadable
          .map((account) => account.id)
          .join(
            ", ",
          )}). Reconnect those accounts: rotation cannot fix a value it cannot read.\n`,
      );
      return 1;
    }

    if (outdated.length === 0) {
      process.stdout.write(
        "Every account is already on the current version.\n",
      );
      return 0;
    }

    if (!options.confirm) {
      process.stdout.write(
        `${outdated.map((account) => account.id).join("\n")}\nDry run: nothing was written. Re-run with --confirm to re-seal the outdated accounts.\n`,
      );
      return 0;
    }

    let failures = 0;

    for (const account of accounts) {
      if (!outdated.some((row) => row.id === account.id)) continue;

      try {
        const sealed = {
          accessToken: encryptToken(
            decryptToken(account.accessToken, ring),
            ring,
          ),
          refreshToken: encryptToken(
            decryptToken(account.refreshToken, ring),
            ring,
          ),
        };

        // Belt and braces: a rewrite that is not on the current version would
        // leave the row exactly as outdated as it was.
        if (
          readPayloadVersion(sealed.accessToken) !== ring.currentVersion ||
          readPayloadVersion(sealed.refreshToken) !== ring.currentVersion
        ) {
          throw new RotationFailure(
            `Re-sealing did not produce v${ring.currentVersion}.`,
          );
        }

        await prisma.channelAccount.update({
          where: { id: account.id },
          data: sealed,
        });
      } catch (error) {
        failures += 1;
        process.stderr.write(
          `Could not re-seal account ${account.id}: ${describeError(error)}\n`,
        );
      }
    }

    if (failures > 0) {
      process.stderr.write(
        `${failures} account(s) could not be re-sealed. Reconnect them, then run this again.\n`,
      );
      return 1;
    }

    process.stdout.write(
      `Re-sealed ${outdated.length} account(s) under v${ring.currentVersion}.\n`,
    );
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

async function openDatabase(): Promise<typeof import("@/lib/db")> {
  try {
    return await import("@/lib/db");
  } catch (error) {
    throw new RotationFailure(
      `Could not open the database: ${describeError(error)}. DATABASE_URL must be set.`,
    );
  }
}

function formatVersions(versions: readonly number[]): string {
  return versions.length === 0
    ? "none"
    : [...versions]
        .sort((a, b) => a - b)
        .map((version) => `v${version}`)
        .join(", ");
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`The rotation failed: ${describeError(error)}\n`);
    process.exitCode = 1;
  });
