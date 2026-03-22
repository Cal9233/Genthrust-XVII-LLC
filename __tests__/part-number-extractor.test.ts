/**
 * Tests for lib/utils/part-number-extractor.ts
 * Covers happy paths, edge cases, exclusion list, and email parsing
 */
import { describe, it, expect } from "vitest";
import {
  extractPartNumbers,
  parseEmailForParts,
} from "@/lib/utils/part-number-extractor";

describe("extractPartNumbers", () => {
  // --- Happy path: pattern matching ---

  it("extracts ABC-123 style part numbers (letters-dash-digits)", () => {
    const result = extractPartNumbers("Part number ABC-123 needs inspection");
    expect(result).toContain("ABC-123");
  });

  it("extracts alphanumeric part numbers without dashes (e.g. ABC123)", () => {
    const result = extractPartNumbers("Order part ABC1234 today");
    expect(result).toContain("ABC1234");
  });

  it("extracts digit-dash-letter patterns (e.g. 123-ABC)", () => {
    const result = extractPartNumbers("Reference 123-ABC in the manifest");
    expect(result).toContain("123-ABC");
  });

  it("extracts alternating letter-digit patterns (e.g. A1B2C3)", () => {
    const result = extractPartNumbers("Component A1B2C3 is on backorder");
    expect(result).toContain("A1B2C3");
  });

  it("extracts numeric hyphen patterns (e.g. 12-34-56)", () => {
    const result = extractPartNumbers("Drawing 12-34-56 required");
    expect(result).toContain("12-34-56");
  });

  it("extracts P/N: prefixed part numbers", () => {
    const result = extractPartNumbers("P/N: AB-1234 ordered");
    expect(result.some((p) => p.includes("AB-1234"))).toBe(true);
  });

  it("extracts PN: prefixed part numbers", () => {
    const result = extractPartNumbers("PN: XY-9876 shipped");
    expect(result.some((p) => p.includes("XY-9876"))).toBe(true);
  });

  it("extracts multiple part numbers from a single string", () => {
    const result = extractPartNumbers("Parts ABC-123 and XYZ-456 are required");
    expect(result).toContain("ABC-123");
    expect(result).toContain("XYZ-456");
  });

  it("deduplicates identical part numbers", () => {
    const result = extractPartNumbers("ABC-123 and ABC-123 again");
    const count = result.filter((p) => p === "ABC-123").length;
    expect(count).toBe(1);
  });

  it("is case-insensitive (converts to uppercase)", () => {
    const result = extractPartNumbers("part abc-123 is needed");
    expect(result).toContain("ABC-123");
  });

  // --- Edge cases ---

  it("returns empty array for empty string", () => {
    expect(extractPartNumbers("")).toEqual([]);
  });

  it("returns empty array for null/falsy input", () => {
    // @ts-expect-error testing runtime null
    expect(extractPartNumbers(null)).toEqual([]);
  });

  it("returns empty array when no part numbers are found", () => {
    // Avoid words that trigger the "No./# format" capture (e.g. "No" + word)
    expect(extractPartNumbers("Hello world, just plain text here")).toEqual([]);
  });

  it("does not return part numbers shorter than 3 characters", () => {
    const result = extractPartNumbers("AB X1");
    // Short items should not appear
    result.forEach((p) => expect(p.length).toBeGreaterThanOrEqual(3));
  });

  it("does not return part numbers longer than 30 characters", () => {
    const longPart = "A".repeat(31) + "-" + "1".repeat(5);
    const result = extractPartNumbers(longPart);
    result.forEach((p) => expect(p.length).toBeLessThanOrEqual(30));
  });

  // --- Exclusion list ---

  it("excludes currency codes like USD", () => {
    const result = extractPartNumbers("Price: USD 5000");
    expect(result).not.toContain("USD");
  });

  it("excludes month abbreviations like JAN", () => {
    const result = extractPartNumbers("Date: JAN 2024");
    expect(result).not.toContain("JAN");
  });

  it("excludes day abbreviations like MON", () => {
    const result = extractPartNumbers("Due: MON morning");
    expect(result).not.toContain("MON");
  });

  it("excludes company type abbreviations like LLC", () => {
    const result = extractPartNumbers("Genthrust XVII LLC");
    expect(result).not.toContain("LLC");
  });

  it("excludes timezone abbreviations like UTC", () => {
    const result = extractPartNumbers("Sent at 10:00 UTC");
    expect(result).not.toContain("UTC");
  });

  it("excludes file extension abbreviations like PDF", () => {
    const result = extractPartNumbers("Download the PDF file");
    expect(result).not.toContain("PDF");
  });
});

describe("parseEmailForParts", () => {
  it("extracts part numbers from email subject", () => {
    const email = { subject: "Request for part ABC-123" };
    const result = parseEmailForParts(email);
    expect(result).toContain("ABC-123");
  });

  it("extracts part numbers from email body content", () => {
    const email = {
      subject: "Quote request",
      body: { content: "<p>We need part XYZ-789</p>" },
    };
    const result = parseEmailForParts(email);
    expect(result).toContain("XYZ-789");
  });

  it("strips HTML tags from body before extracting", () => {
    const email = {
      body: {
        content: "<b>Part</b> <span>ABC-999</span> needed urgently",
      },
    };
    const result = parseEmailForParts(email);
    expect(result).toContain("ABC-999");
  });

  it("deduplicates parts found in both subject and body", () => {
    const email = {
      subject: "Part ABC-123 inquiry",
      body: { content: "We need ABC-123 please" },
    };
    const result = parseEmailForParts(email);
    const count = result.filter((p) => p === "ABC-123").length;
    expect(count).toBe(1);
  });

  it("returns empty array when email has no subject or body", () => {
    const result = parseEmailForParts({});
    expect(result).toEqual([]);
  });

  it("handles email with only subject and no body", () => {
    // Use a subject that has no part-number-like tokens
    const email = { subject: "Hello world, checking in today" };
    const result = parseEmailForParts(email);
    expect(result).toEqual([]);
  });

  it("handles email with body but no subject", () => {
    const email = { body: { content: "Part DEF-456 is needed" } };
    const result = parseEmailForParts(email);
    expect(result).toContain("DEF-456");
  });
});
