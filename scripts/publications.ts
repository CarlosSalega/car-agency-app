import "dotenv/config";

import {
  buildIdempotencyKey,
  DEFAULT_DRAIN_LIMIT,
  drain,
  enqueue,
  formatDrainSummary,
  listClaimable,
} from "@/lib/jobs";
import type { JobRow, JobRegistry, JobStore } from "@/lib/jobs/types";
import type { MeliRuntime } from "@/lib/integrations/mercadolibre/publications/runtime";

/**
 * Queue one MercadoLibre publication operation, or drain the queue.
 *
 * A thin shell, like `rotate:tokens` and `drain:jobs`. The rules — idempotency,
 * the state machine, what a failure means — live in
 * `src/lib/integrations/mercadolibre/publications/` and are tested without a
 * database or a network. This file parses flags, resolves the vehicle and the
 * linked account, enqueues, and prints.
 *
 * Dry run is the default for every command that mutates the marketplace:
 * publishing a vehicle costs money and cannot be undone with a flag, so
 * enqueueing must be the deliberate action. `sync` is read-only and does not
 * need `--confirm`; `drain` does, because the queued jobs it would run are the
 * mutations.
 */

const CHANNEL = "MERCADOLIBRE";

const USAGE = `Usage: pnpm publications <command> [options]

Commands:
  publish <carId>           Queue the creation of the Mercado Libre listing.
  update <carId>            Queue a price update (the sold cascade closes the
                            listing instead, per D1).
  pause <carId>             Queue a pause of the listing.
  close <carId>             Queue a close of the listing.
  sync <carId>              Queue a read-only reconciliation with Mercado Libre.
  drain                     Run one pass over the job queue.

Dry run by default. publish, update, pause, close and drain only report what
they would do; add --confirm to enqueue the job or to run the pass. sync is
read-only, so it enqueues without --confirm.

Options:
  --confirm                 Actually enqueue the job / run the drain pass.
  --limit=<n>               For drain: claim at most <n> jobs. Default: ${DEFAULT_DRAIN_LIMIT}.
  --dry-run                 Only describe what would happen (the default).
  --help                    Print this message and exit 0.

The job is idempotent: the same vehicle, channel and account always produce the
same idempotency key, so running a command twice does not queue the work twice.

Exit codes: 0 on success, 1 when the command failed, 2 on a usage error.
`;

type Command = "publish" | "update" | "pause" | "close" | "sync" | "drain";

const COMMANDS: readonly Command[] = [
  "publish",
  "update",
  "pause",
  "close",
  "sync",
  "drain",
];

/** Commands that write to Mercado Libre, and therefore need `--confirm`. */
const MUTATING: ReadonlySet<Command> = new Set<Command>([
  "publish",
  "update",
  "pause",
  "close",
]);

interface Options {
  readonly command: Command;
  readonly carId: string | null;
  readonly confirm: boolean;
  readonly limit: number;
}

type ParsedArgs =
  | { readonly kind: "help" }
  | { readonly kind: "options"; readonly options: Options }
  | { readonly kind: "error"; readonly message: string };

/** An expected failure: printed as one readable line, without a stack trace. */
class CommandFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandFailure";
  }
}

function isCommand(value: string): value is Command {
  return (COMMANDS as readonly string[]).includes(value);
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let confirm = false;
  let dryRun = false;
  let limit = DEFAULT_DRAIN_LIMIT;
  let limitProvided = false;
  const positional: string[] = [];

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { kind: "help" };

    if (arg === "--confirm") {
      confirm = true;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const raw = arg.slice("--limit=".length);
      const parsed = Number(raw);

      if (raw === "" || !Number.isInteger(parsed) || parsed < 0) {
        return {
          kind: "error",
          message: `--limit must be a whole number of jobs, got "${raw}".`,
        };
      }

      limit = parsed;
      limitProvided = true;
      continue;
    }

    if (arg.startsWith("-")) {
      return { kind: "error", message: `Unknown option: ${arg}.` };
    }

    positional.push(arg);
  }

  if (confirm && dryRun) {
    return {
      kind: "error",
      message:
        "--dry-run and --confirm contradict each other: --confirm is the real run.",
    };
  }

  const [command, ...rest] = positional;

  if (command === undefined) {
    return {
      kind: "error",
      message:
        "Missing command. Expected one of: publish, update, pause, close, sync, drain.",
    };
  }

  if (!isCommand(command)) {
    return {
      kind: "error",
      message: `Unknown command "${command}". Expected one of: ${COMMANDS.join(", ")}.`,
    };
  }

  if (command === "drain") {
    if (rest.length > 0) {
      return {
        kind: "error",
        message: `drain does not take a vehicle id (got "${rest[0]}").`,
      };
    }

    return {
      kind: "options",
      options: { command, carId: null, confirm, limit },
    };
  }

  if (rest.length !== 1) {
    return {
      kind: "error",
      message: `${command} needs exactly one vehicle id.`,
    };
  }

  if (limitProvided) {
    return { kind: "error", message: "--limit only applies to drain." };
  }

  return {
    kind: "options",
    options: { command, carId: rest[0], confirm, limit },
  };
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
    if (error instanceof CommandFailure) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }

    process.stderr.write(
      `The command failed unexpectedly: ${describeError(error)}\n`,
    );
    return 1;
  }
}

async function run(options: Options): Promise<number> {
  // Imported lazily: `@/lib/db` builds a Prisma client while it is evaluated,
  // and `--help` must work with no environment at all.
  const { prisma } = await openDatabase();

  try {
    const store = prisma as unknown as JobStore;
    const { createMeliRuntime, MeliRuntimeError } =
      await import("@/lib/integrations/mercadolibre/publications/runtime");

    try {
      const runtime = createMeliRuntime();

      if (options.command === "drain") {
        return await drainQueue(store, runtime.registry, options);
      }

      return await queuePublication(
        store,
        runtime,
        options,
        options.carId ?? "",
      );
    } catch (error) {
      if (error instanceof MeliRuntimeError) {
        throw new CommandFailure(error.message);
      }

      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function drainQueue(
  store: JobStore,
  registry: JobRegistry,
  options: Options,
): Promise<number> {
  const now = new Date();

  if (!options.confirm) {
    const claimable = await listClaimable(store, {
      now,
      limit: options.limit,
    });

    process.stdout.write(
      [
        "Dry run: nothing is claimed and nothing is written.",
        `Claimable now: ${claimable.length} (limit ${options.limit})`,
        ...claimable.map(describeJob),
        "Re-run with `pnpm publications drain --confirm` to run them.",
      ].join("\n") + "\n",
    );

    return 0;
  }

  const summary = await drain({
    store,
    registry,
    workerId: `publications:${process.pid}`,
    now: () => new Date(),
    limit: options.limit,
  });

  process.stdout.write(`${formatDrainSummary(summary)}\n`);

  return summary.dead + summary.failed > 0 ? 1 : 0;
}

function describeJob(job: JobRow): string {
  return `  ${job.id}  ${job.kind}  runAt=${job.runAt.toISOString()}  attempts=${job.attempts}/${job.maxAttempts}  key=${job.idempotencyKey}`;
}

async function queuePublication(
  store: JobStore,
  runtime: MeliRuntime,
  options: Options,
  carId: string,
): Promise<number> {
  const account = await runtime.readAccount();
  const idempotencyKey = buildIdempotencyKey({
    kind: options.command,
    channel: CHANNEL,
    accountId: account.id,
    carId,
  });

  const mutating = MUTATING.has(options.command);

  if (mutating && !options.confirm) {
    const publication = await runtime.findPublication({
      carId,
      accountId: account.id,
    });

    process.stdout.write(
      [
        "Dry run: nothing was enqueued.",
        `  command: ${options.command}`,
        `  vehicle: ${carId}`,
        `  account: ${account.id}${account.remoteNickname === null ? "" : ` (${account.remoteNickname})`}`,
        `  publication: ${
          publication === null
            ? "se crea al confirmar"
            : `${publication.id} (${publication.state}${publication.remoteId === null ? "" : `, ${publication.remoteId}`})`
        }`,
        `  job key: ${idempotencyKey}`,
        `Re-run with \`pnpm publications ${options.command} ${carId} --confirm\` to enqueue it.`,
      ].join("\n") + "\n",
    );

    return 0;
  }

  const publication = await runtime.ensurePublication({
    carId,
    accountId: account.id,
  });

  const job = await enqueue(store, {
    kind: options.command,
    idempotencyKey,
    payload: { publicationId: publication.id },
    now: new Date(),
  });

  process.stdout.write(
    `Enqueued ${options.command} for ${carId} as publication ${publication.id} (job ${job.id}, key ${idempotencyKey}).\n`,
  );

  return 0;
}

async function openDatabase(): Promise<typeof import("@/lib/db")> {
  try {
    return await import("@/lib/db");
  } catch (error) {
    throw new CommandFailure(
      `Could not open the database: ${describeError(error)}. DATABASE_URL must be set.`,
    );
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`The command failed: ${describeError(error)}\n`);
    process.exitCode = 1;
  });
