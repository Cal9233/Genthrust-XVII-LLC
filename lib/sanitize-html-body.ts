/**
 * Sanitize HTML body for email drafts.
 * Strips dangerous tags, URIs, and event handlers while preserving safe formatting.
 */

import sanitizeHtml from "sanitize-html";

/**
 * Sanitizes HTML content for safe inclusion in email drafts.
 * Uses sanitize-html to properly handle XSS vectors including:
 * - script, iframe, object, embed, svg, math, form, input tags
 * - Event handler attributes (on*)
 * - javascript: URIs (including entity-encoded variants)
 */
export function sanitizeEmailBody(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "b", "i", "em", "strong", "a", "br",
      "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "blockquote",
      "table", "tr", "td", "th", "thead", "tbody",
      "div", "span",
      "img",
    ],
    allowedAttributes: {
      a: ["href"],
      img: ["src", "alt"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    disallowedTagsMode: "discard",
  });
}
