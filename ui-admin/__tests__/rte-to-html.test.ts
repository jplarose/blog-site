import { describe, expect, it } from "vitest";

import { richTextJsonToHtml, richTextToHtml } from "@/components/rte/toHtml";

const editorDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Hello " },
        { type: "text", text: "world", marks: [{ type: "bold" }] },
        { type: "text", text: " " },
        {
          type: "text",
          text: "link",
          marks: [{ type: "link", attrs: { href: "https://example.com" } }],
        },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "item" }] },
          ],
        },
      ],
    },
  ],
};

describe("richTextJsonToHtml", () => {
  it("converts an editor document to rich HTML, not serialized JSON", () => {
    const html = richTextJsonToHtml(editorDoc);

    expect(html.startsWith("<")).toBe(true);
    expect(html).not.toContain('{"type":"doc"');
    expect(html).toContain("<p>");
    expect(html).toContain("<strong>world</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain('href="https://example.com"');
    // Parseable HTML round-trips through the DOM without loss of structure.
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("p")).not.toBeNull();
    expect(doc.querySelector("ul > li")).not.toBeNull();
  });

  it("sanitizes disallowed markup out of the generated HTML", () => {
    const html = richTextJsonToHtml({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "bad",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    });

    expect(html).not.toContain("javascript:");
  });
});

describe("richTextToHtml — canonical HTML content", () => {
  it("passes stored rich HTML through sanitized instead of escaping it", () => {
    const html = richTextToHtml("<p>Hello <strong>world</strong></p>");

    expect(html).toBe("<p>Hello <strong>world</strong></p>");
    expect(html).not.toContain("&lt;p&gt;");
  });

  it("still sanitizes hostile stored HTML", () => {
    const html = richTextToHtml('<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)>');

    expect(html).toContain("<p>ok</p>");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("onerror");
  });

  it("still converts legacy serialized Tiptap JSON", () => {
    const html = richTextToHtml(JSON.stringify(editorDoc));

    expect(html).toContain("<strong>world</strong>");
    expect(html).not.toContain('{"type":"doc"');
  });

  it("still escapes legacy plain text into a paragraph", () => {
    expect(richTextToHtml("1 < 2 & 3 > 2")).toBe("<p>1 &lt; 2 &amp; 3 &gt; 2</p>");
  });
});
