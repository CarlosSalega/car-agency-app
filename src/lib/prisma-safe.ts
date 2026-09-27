import { Prisma } from "@generated/prisma/client";

type RetryOptions = {
  retries?: number;
  delay?: number;
  log?: boolean;
};

// Duck-typed on purpose, and deliberately NOT `error instanceof Error`.
//
// The original was `String(error?.message || "")`, which reads `.message` off
// anything — including a plain object like `{ message: "Connection
// terminated..." }`. Narrowing to `instanceof Error` would silently turn such a
// throw from retryable into a rethrow, i.e. a resilience regression hiding
// behind a type-safety improvement.
//
// The retry classifier below runs in a catch block precisely because we do not
// control what gets thrown. Keep it maximally permissive, but typed.
function getErrorMessage(error: unknown): string {
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return "";
  }

  const { message } = error as { message: unknown };

  return typeof message === "string" ? message : String(message ?? "");
}

export async function prismaSafe<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    retries = 3,
    delay = 800,
    log = process.env.NODE_ENV === "development",
  } = options;

  try {
    return await fn();
  } catch (error: unknown) {
    const message = getErrorMessage(error);

    const isConnectionError =
      error instanceof Prisma.PrismaClientInitializationError ||
      message.includes("Can't reach database server") ||
      message.includes("Connection terminated");

    if (!isConnectionError || retries === 0) {
      throw error;
    }

    if (log) {
      console.warn(`[prismaSafe] Retry ${retries} due to connection error...`);
    }

    await new Promise((res) => setTimeout(res, delay));

    return prismaSafe(fn, {
      retries: retries - 1,
      delay,
      log,
    });
  }
}
