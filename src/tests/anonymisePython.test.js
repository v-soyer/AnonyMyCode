// anonymisePython.js.test.js
import { describe, test, expect } from "vitest";
import cases from "./cases/anonymisePython.cases.json";
import { anonymisePython } from "../processors/anonymisePython";

function normalize(s) {
  return (
    s
      // Normalize line endings (CRLF/CR -> LF)
      .replace(/\r\n?/g, "\n")

      // Normalize quotes
      .replace(/'/g, '"')

      // Collapse all whitespace to single spaces
      .replace(/\s+/g, " ")
      .trim()

      // Remove spaces around punctuation that formatting changes often affect
      .replace(/\s*([{}()[\],;:])\s*/g, "$1")

      // Ignore semicolons (mostly irrelevant in Python, but keeps parity)
      .replace(/;/g, "")

      // Keep spaces around some operators stable
      .replace(/\s*=\s*/g, "=")
      .replace(/\s*\+\s*/g, "+")
      .replace(/\s*-\s*/g, "-")
      .replace(/\s*\*\s*/g, "*")
      .replace(/\s*\/\s*/g, "/")
  );
}

describe("anonymisePython golden cases", () => {
  test.each(cases.map((c) => [c.id, c.description, c.before, c.after]))(
    "[%s] %s",
    (id, description, before, expected) => {
      const actual = anonymisePython(before);
      expect(normalize(actual)).toBe(normalize(expected));
    }
  );
});
