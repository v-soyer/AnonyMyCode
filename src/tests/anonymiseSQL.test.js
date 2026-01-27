import { describe, test, expect } from "vitest";
import cases from "./cases/anonymiseSQL.cases.json";
import { anonymiseSQL } from "../processors/anonymiseSQL.js";

function normalize(sql) {
  if (sql == null) return "";

  // 1) Normalize newlines and trim
  let s = String(sql).replace(/\r\n?/g, "\n").trim();

  // 2) Strip comments safely (line + block)
  // (If your anonymiser already strips them, this just avoids test flakiness.)
  s = s
    .replace(/--[^\n]*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  // 3) Protect string literals so we don't break their content while normalizing
  // Supports: '...', "...", with escaped quotes like '' or \".
  const strings = [];
  s = s.replace(
    /'(?:''|[^'])*'|"(?:\\"|""|[^"])*"/g,
    (m) => `__STR${strings.push(m) - 1}__`
  );

  // 4) Normalize identifier quoting style: treat `x` and [x] as "x"
  // This helps if your SQL generator differs by dialect.
  s = s
    .replace(/`([^`]+)`/g, '"$1"')
    .replace(/\[([^\]]+)\]/g, '"$1"');

  // 5) Case-insensitive keyword normalization (optional but stabilizes output)
  // Keep it minimal: only common structural keywords.
  s = s.replace(
    /\b(select|from|where|join|inner|left|right|full|cross|on|group by|having|order by|limit|offset|union|all|distinct|with|as|insert into|values|update|set|delete from|returning|exists|in|like|ilike|over|partition by)\b/gi,
    (m) => m.toUpperCase()
  );

  // 6) Collapse whitespace to single spaces
  s = s.replace(/\s+/g, " ").trim();

  // 7) Normalize spacing around punctuation/operators commonly reformatted
  s = s
    // remove spaces around parentheses, commas, semicolons
    .replace(/\s*([(),;])\s*/g, "$1")
    // keep dot tight: t1 . A -> t1.A
    .replace(/\s*\.\s*/g, ".")
    // normalize comparison ops
    .replace(/\s*(=|<>|!=|<=|>=|<|>)\s*/g, "$1")
    // normalize arithmetic ops
    .replace(/\s*([+\-*/%])\s*/g, "$1")
    // normalize logical ops spacing
    .replace(/\s+(AND|OR)\s+/g, " $1 ")
    // normalize AS spacing
    .replace(/\s+AS\s+/g, " AS ");

  // 8) Remove trailing semicolons (golden cases may vary)
  s = s.replace(/;+$/g, "");

  // 9) Restore protected strings
  s = s.replace(/__STR(\d+)__/g, (_, i) => strings[Number(i)]);

  // 10) Optional: normalize single quotes vs double quotes in strings
  // If your anonymiser always uses single quotes, you can remove this.
  // If you want to ignore quote style differences in *string literals*, uncomment:
  // s = s.replace(/'([^']*)'/g, '"$1"');

  return s;
}

describe("anonymiseSQL golden cases", () => {
  test.each(cases.map((c) => [c.id, c.description, c.before, c.after]))(
    "[%s] %s",
    (id, description, before, expected) => {
      const actual = anonymiseSQL(before);
      expect(normalize(actual)).toBe(normalize(expected));
    }
  );
});
