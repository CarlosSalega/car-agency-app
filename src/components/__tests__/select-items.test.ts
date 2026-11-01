import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every `<Select>` must be told how to label its items.
 *
 * Base UI's `Select.Value` renders the raw `value` unless the root receives
 * `items`. That is fine while value and label are the same string, and silently
 * wrong the moment they differ: the footer of this bug was a status select whose
 * list said "En negociación" and whose trigger said "NEGOTIATING", plus brand and
 * model selects that printed a uuid.
 *
 * Thirteen roots had drifted. This sweep is what stops the fourteenth: adding a
 * select without `items` fails here instead of in front of a client.
 */
const SRC = path.resolve(__dirname, "..");

interface Root {
  file: string;
  line: number;
  block: string;
}

function collectSelectRoots(dir: string, found: Root[] = []): Root[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      collectSelectRoots(full, found);
      continue;
    }

    if (!entry.name.endsWith(".tsx") || entry.name.includes(".test.")) continue;

    const lines = fs.readFileSync(full, "utf8").split("\n");
    lines.forEach((line, index) => {
      // The root, not the `SelectItem` or `SelectTrigger` that also start with it.
      if (!/<Select\s*$/.test(line)) return;

      // A root's attributes run until the line that is only `>`.
      const block: string[] = [];
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        if (/^\s*>\s*$/.test(lines[cursor])) {
          found.push({
            file: path.relative(path.resolve(SRC, ".."), full),
            line: index + 1,
            block: block.join("\n"),
          });
          return;
        }
        block.push(lines[cursor]);
        // A root that never closes means the parser above is wrong, not the code.
        if (block.length > 40) return;
      }
    });
  }

  return found;
}

describe("Select roots carry their labels", () => {
  const roots = collectSelectRoots(SRC);

  it("finds the roots at all, so the sweep cannot pass vacuously", () => {
    expect(roots.length).toBeGreaterThan(5);
  });

  it("gives every root an items prop, which is what makes the trigger readable", () => {
    const missing = roots
      .filter((root) => !/\bitems=/.test(root.block))
      .map((root) => `${root.file}:${root.line}`);

    expect(missing).toEqual([]);
  });
});
