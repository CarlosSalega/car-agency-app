export async function mapWithConcurrency<Item, Result>(
  items: readonly Item[],
  limit: number,
  worker: (item: Item, index: number) => Promise<Result>,
): Promise<Result[]> {
  const normalizedLimit = Number.isFinite(limit)
    ? Math.max(1, Math.floor(limit))
    : 1;
  const results = new Array<Result>(items.length);
  const running: Promise<void>[] = [];
  let cursor = 0;

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index] as Item, index);
    }
  }

  const workers = Math.min(normalizedLimit, items.length);

  for (let index = 0; index < workers; index += 1) {
    running.push(run());
  }

  await Promise.all(running);

  return results;
}
