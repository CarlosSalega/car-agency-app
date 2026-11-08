#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";

const MODULE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_TARGETS = ["."];
const COMMENT_KINDS = new Set([
  ts.SyntaxKind.SingleLineCommentTrivia,
  ts.SyntaxKind.MultiLineCommentTrivia,
]);

const TRIVIA_KINDS = new Set([
  ts.SyntaxKind.WhitespaceTrivia,
  ts.SyntaxKind.NewLineTrivia,
  ts.SyntaxKind.ShebangTrivia,
  ts.SyntaxKind.ConflictMarkerTrivia,
]);

const ENDS_EXPRESSION_KINDS = new Set([
  ts.SyntaxKind.Identifier,
  ts.SyntaxKind.PrivateIdentifier,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.BigIntLiteral,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.RegularExpressionLiteral,
  ts.SyntaxKind.ThisKeyword,
  ts.SyntaxKind.SuperKeyword,
  ts.SyntaxKind.TrueKeyword,
  ts.SyntaxKind.FalseKeyword,
  ts.SyntaxKind.NullKeyword,
  ts.SyntaxKind.CloseParenToken,
  ts.SyntaxKind.CloseBracketToken,
  ts.SyntaxKind.CloseBraceToken,
  ts.SyntaxKind.PlusPlusToken,
  ts.SyntaxKind.MinusMinusToken,
]);

function collectTsFiles(target) {
  const absolute = resolve(MODULE_ROOT, target);
  let stats;
  try {
    stats = statSync(absolute);
  } catch {
    return [];
  }
  if (stats.isFile()) {
    return absolute.endsWith(".ts") && !absolute.endsWith(".tsx")
      ? [absolute]
      : [];
  }
  const files = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = join(absolute, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(child));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".tsx")
    ) {
      files.push(child);
    }
  }
  return files;
}

function findCommentRanges(text) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    /* skipTrivia */ false,
    ts.LanguageVariant.Standard,
    text,
  );
  const ranges = [];
  const templateFrames = [];
  let previousSignificant = ts.SyntaxKind.Unknown;
  let kind = scanner.scan();

  while (kind !== ts.SyntaxKind.EndOfFileToken) {
    if (kind === ts.SyntaxKind.TemplateHead) {
      templateFrames.push({ braces: 0 });
    } else if (templateFrames.length > 0) {
      const frame = templateFrames[templateFrames.length - 1];
      if (kind === ts.SyntaxKind.OpenBraceToken) {
        frame.braces += 1;
      } else if (kind === ts.SyntaxKind.CloseBraceToken) {
        if (frame.braces > 0) {
          frame.braces -= 1;
        } else {
          kind = scanner.reScanTemplateToken(/* isTaggedTemplate */ false);
          if (kind === ts.SyntaxKind.TemplateTail) {
            templateFrames.pop();
          }
          previousSignificant = kind;
          kind = scanner.scan();
          continue;
        }
      }
    }

    if (COMMENT_KINDS.has(kind)) {
      ranges.push([scanner.getTokenStart(), scanner.getTokenEnd()]);
      kind = scanner.scan();
      continue;
    }

    if (
      kind === ts.SyntaxKind.SlashToken &&
      !ENDS_EXPRESSION_KINDS.has(previousSignificant)
    ) {
      kind = scanner.reScanSlashToken();
      previousSignificant = kind;
      kind = scanner.scan();
      continue;
    }

    if (!TRIVIA_KINDS.has(kind)) {
      previousSignificant = kind;
    }
    kind = scanner.scan();
  }

  return ranges;
}

function removeRanges(text, ranges) {
  let result = text;
  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const [start, end] = ranges[index];
    result = result.slice(0, start) + result.slice(end);
  }
  return result;
}

function tidyWhitespace(text) {
  const lines = text.split("\n").map((line) => line.replace(/[ \t]+$/, ""));
  const collapsed = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\{\n[ \t]*\n/g, "{\n")
    .replace(/\n[ \t]*\n([ \t]*\})/g, "\n$1")
    .replace(/^\n+/, "");
  return `${collapsed.replace(/\n+$/, "")}\n`;
}

const targets = process.argv.slice(2);
const requestedTargets = targets.length > 0 ? targets : DEFAULT_TARGETS;
const files = [...new Set(requestedTargets.flatMap(collectTsFiles))].sort();

let totalRanges = 0;
let changedFiles = 0;

for (const file of files) {
  const original = readFileSync(file, "utf8");
  const ranges = findCommentRanges(original);
  const tidied = tidyWhitespace(removeRanges(original, ranges));

  if (tidied === original) {
    continue;
  }

  writeFileSync(file, tidied);
  totalRanges += ranges.length;
  changedFiles += 1;
  const label = relative(MODULE_ROOT, file);
  console.log(
    `${label.startsWith("..") ? file : label}: ${ranges.length} comment range(s) removed`,
  );
}

console.log(
  `Total: ${totalRanges} comment range(s) removed from ${changedFiles} file(s)`,
);
