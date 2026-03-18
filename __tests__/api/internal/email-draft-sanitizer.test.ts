import { describe, it, expect } from "vitest";
import { sanitizeEmailBody } from "@/lib/sanitize-html-body";

describe("sanitizeEmailBody", () => {
  it("1. strips <script> tags entirely", () => {
    const input = '<script>alert(1)</script>';
    const result = sanitizeEmailBody(input);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert(1)");
  });

  it("2. strips <iframe> tags entirely", () => {
    const input = '<iframe src="evil"></iframe>';
    const result = sanitizeEmailBody(input);
    expect(result).not.toContain("<iframe");
    expect(result).not.toContain("evil");
  });

  it("3. removes event handlers but keeps content", () => {
    const input = '<div onclick="alert(1)">text</div>';
    const result = sanitizeEmailBody(input);
    expect(result).toBe("<div>text</div>");
  });

  it("4. strips javascript: href from anchor tags", () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeEmailBody(input);
    expect(result).not.toContain("javascript:");
    expect(result).not.toContain("alert");
  });

  it("5. strips entity-encoded javascript: URI bypass", () => {
    const input = '<a href="java&#115;cript:alert(1)">click</a>';
    const result = sanitizeEmailBody(input);
    expect(result).not.toContain("javascript:");
    expect(result).not.toContain("alert");
  });

  it("6. strips <svg> with onload handler", () => {
    const input = '<svg onload="alert(1)"></svg>';
    const result = sanitizeEmailBody(input);
    expect(result).not.toContain("<svg");
    expect(result).not.toContain("alert");
  });

  it("7. preserves legitimate HTML formatting", () => {
    const input = "<p>Normal <b>bold</b> text</p>";
    const result = sanitizeEmailBody(input);
    expect(result).toBe("<p>Normal <b>bold</b> text</p>");
  });

  it("8. strips <object> tags", () => {
    const input = '<object data="evil"></object>';
    const result = sanitizeEmailBody(input);
    expect(result).not.toContain("<object");
    expect(result).not.toContain("evil");
  });

  it("9. strips <embed> tags", () => {
    const input = '<embed src="evil">';
    const result = sanitizeEmailBody(input);
    expect(result).not.toContain("<embed");
    expect(result).not.toContain("evil");
  });

  it("10. strips <math> tags (mXSS vector)", () => {
    const input = "<math><mi>x</mi></math>";
    const result = sanitizeEmailBody(input);
    expect(result).not.toContain("<math");
    expect(result).not.toContain("<mi");
  });
});
