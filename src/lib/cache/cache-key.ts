export function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map(stableStringify).join(",")}]`;
  }

  const sortedKeys = Object.keys(obj).sort();

  const result = sortedKeys
    .filter((key) => obj[key] !== undefined)
    .map((key) => `"${key}":${stableStringify(obj[key])}`)
    .join(",");

  return `{${result}}`;
}
