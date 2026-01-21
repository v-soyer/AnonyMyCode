import { describe, it, test, expect } from "vitest";
import cases from "./cases/anonymiseJS.cases.json";
import { anonymiseJS } from "../processors/anonymiseJS";

function normalize(s) {
  return s
    // Normalize line endings (CRLF/CR -> LF)
    .replace(/\r\n?/g, "\n")

    // Normalize quotes
    .replace(/'/g, '"')

    // Collapse all whitespace to single spaces
    .replace(/\s+/g, " ")
    .trim()

    // Remove spaces around punctuation that formatting changes often affect
    .replace(/\s*([{}()[\],;:])\s*/g, "$1")

    // Ignore semicolons
    .replace(/;/g, "")

    // Keep spaces around some operators/keywords stable (optional but helps readability)
    .replace(/\s*=\s*/g, "=")
    .replace(/\s*\+\s*/g, "+");
}

describe("anonymiseJS golden cases", () => {
  test.each(cases.map(c => [c.id, c.description, c.before, c.after]))(
    "[%s] %s",
    (id, description, before, expected) => {
      const actual = anonymiseJS(before);
      expect(normalize(actual)).toBe(normalize(expected));
    }
  );
});
