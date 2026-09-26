import { Prisma } from "@generated/prisma/client";

type RetryOptions = {
  retries?: number;
  delay?: number;
  log?: boolean;
};

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
  } catch (error: any) {
    const message = String(error?.message || "");

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
