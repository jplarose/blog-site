import { describe, expect, it } from "vitest";

import type { Post } from "@/lib/api";
import { renderTemplate } from "@/lib/render-template";

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    title: "Hello World",
    slug: "hello-world",
    content: "<p>Body</p>",
    excerpt: "A short summary",
    featuredImageUrl: undefined,
    status: "Published",
    publishedAt: undefined,
    categoryId: undefined,
    categoryName: undefined,
    templateId: 1,
    templateKey: "article",
    templateName: "Article",
    tags: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("renderTemplate — token substitution", () => {
  it("substitutes {{title}} with an escaped value", () => {
    const html = renderTemplate("<h1>{{title}}</h1>", post({ title: "My Post" }));
    expect(html).toBe("<h1>My Post</h1>");
  });

  it("substitutes {{content}} as raw, unescaped HTML (already sanitized server-side)", () => {
    const html = renderTemplate("<div>{{content}}</div>", post({ content: "<p>Rich <b>body</b></p>" }));
    expect(html).toBe("<div><p>Rich <b>body</b></p></div>");
  });

  it("substitutes {{excerpt}}, {{category}}, and {{tags}}", () => {
    const html = renderTemplate(
      "<p>{{excerpt}}</p><span>{{category}}</span><span>{{tags}}</span>",
      post({ excerpt: "Summary text", categoryName: "News", tags: ["a", "b"] })
    );
    expect(html).toBe("<p>Summary text</p><span>News</span><span>a, b</span>");
  });

  it("replaces every occurrence of a repeated token", () => {
    const html = renderTemplate("{{title}} / {{title}}", post({ title: "Post" }));
    expect(html).toBe("Post / Post");
  });
});

describe("renderTemplate — escaping", () => {
  it("escapes a title containing a script tag", () => {
    const html = renderTemplate("<h1>{{title}}</h1>", post({ title: "<script>alert(1)</script>" }));
    expect(html).toBe("<h1>&lt;script&gt;alert(1)&lt;/script&gt;</h1>");
    expect(html).not.toContain("<script>");
  });

  it("escapes quotes and ampersands in plain-text tokens", () => {
    const html = renderTemplate("<span>{{category}}</span>", post({ categoryName: `Tom & "Jerry"` }));
    expect(html).toBe("<span>Tom &amp; &quot;Jerry&quot;</span>");
  });

  it("escapes single quotes in plain-text tokens", () => {
    const html = renderTemplate("<span>{{excerpt}}</span>", post({ excerpt: "It's here" }));
    expect(html).toBe("<span>It&#39;s here</span>");
  });

  it("escapes HTML in tag names before joining", () => {
    const html = renderTemplate("<span>{{tags}}</span>", post({ tags: ["<b>bold</b>", "safe"] }));
    expect(html).toBe("<span>&lt;b&gt;bold&lt;/b&gt;, safe</span>");
  });
});

describe("renderTemplate — featuredImage attribute escaping + scheme filtering", () => {
  it("inserts an http URL as-is into a src attribute", () => {
    const html = renderTemplate(
      '<img src="{{featuredImage}}" />',
      post({ featuredImageUrl: "http://example.com/hero.png" })
    );
    expect(html).toBe('<img src="http://example.com/hero.png" />');
  });

  it("inserts an https URL as-is into a src attribute", () => {
    const html = renderTemplate(
      '<img src="{{featuredImage}}" />',
      post({ featuredImageUrl: "https://example.com/hero.png" })
    );
    expect(html).toBe('<img src="https://example.com/hero.png" />');
  });

  it("allows a relative URL", () => {
    const html = renderTemplate(
      '<img src="{{featuredImage}}" />',
      post({ featuredImageUrl: "/media/hero.png" })
    );
    expect(html).toBe('<img src="/media/hero.png" />');
  });

  it("attribute-escapes a URL containing a double quote so it cannot break out of the attribute", () => {
    const html = renderTemplate(
      '<img src="{{featuredImage}}" />',
      post({ featuredImageUrl: '/media/hero.png" onerror="alert(1)' })
    );
    expect(html).toBe('<img src="/media/hero.png&quot; onerror=&quot;alert(1)" />');
    expect(html).not.toContain('onerror="alert(1)"');
  });

  it("drops a javascript: scheme URL, rendering an empty src", () => {
    const html = renderTemplate(
      '<img src="{{featuredImage}}" />',
      post({ featuredImageUrl: "javascript:alert(1)" })
    );
    expect(html).toBe('<img src="" />');
  });

  it("drops a data: scheme URL", () => {
    const html = renderTemplate(
      '<img src="{{featuredImage}}" />',
      post({ featuredImageUrl: "data:text/html,<script>alert(1)</script>" })
    );
    expect(html).toBe('<img src="" />');
  });

  it("drops a scheme hidden behind control characters (tab-split javascript:)", () => {
    const html = renderTemplate(
      '<img src="{{featuredImage}}" />',
      post({ featuredImageUrl: "java\tscript:alert(1)" })
    );
    expect(html).toBe('<img src="" />');
  });
});

describe("renderTemplate — conditional {{#featuredImage}} section", () => {
  const template = 'before{{#featuredImage}}<img src="{{featuredImage}}" />{{/featuredImage}}after';

  it("keeps the section when featuredImage is present", () => {
    const html = renderTemplate(template, post({ featuredImageUrl: "https://example.com/hero.png" }));
    expect(html).toBe('before<img src="https://example.com/hero.png" />after');
  });

  it("drops the section when featuredImage is absent", () => {
    const html = renderTemplate(template, post({ featuredImageUrl: undefined }));
    expect(html).toBe("beforeafter");
  });

  it("drops the section when featuredImage is an empty string", () => {
    const html = renderTemplate(template, post({ featuredImageUrl: "" }));
    expect(html).toBe("beforeafter");
  });

  it("drops the section when featuredImage has a disallowed scheme, even though a raw value was supplied", () => {
    const html = renderTemplate(template, post({ featuredImageUrl: "javascript:alert(1)" }));
    expect(html).toBe("beforeafter");
  });
});

describe("renderTemplate — missing optional values do not fail rendering", () => {
  const template =
    "<article>" +
    "{{#featuredImage}}<img src=\"{{featuredImage}}\" />{{/featuredImage}}" +
    "<h1>{{title}}</h1>" +
    "<p>{{excerpt}}</p>" +
    "<time>{{publishedAt}}</time>" +
    "<span>{{category}}</span>" +
    "<span>{{tags}}</span>" +
    "<div>{{content}}</div>" +
    "</article>";

  it("renders cleanly when excerpt, featuredImage, category, tags, and publishedAt are all absent", () => {
    const html = renderTemplate(
      template,
      post({
        excerpt: undefined,
        featuredImageUrl: undefined,
        categoryName: undefined,
        tags: [],
        publishedAt: undefined,
      })
    );

    expect(html).toBe(
      "<article><h1>Hello World</h1><p></p><time></time><span></span><span></span><div><p>Body</p></div></article>"
    );
    expect(html).not.toContain("{{");
  });
});

describe("renderTemplate — publishedAt formatting", () => {
  it("formats an ISO timestamp deterministically regardless of local timezone", () => {
    const html = renderTemplate("<time>{{publishedAt}}</time>", post(), "2026-03-05T00:00:00Z");
    expect(html).toBe("<time>March 5, 2026</time>");
  });

  it("renders an empty string for a missing publishedAt", () => {
    const html = renderTemplate("<time>{{publishedAt}}</time>", post(), undefined);
    expect(html).toBe("<time></time>");
  });

  it("renders an empty string for an unparsable publishedAt", () => {
    const html = renderTemplate("<time>{{publishedAt}}</time>", post(), "not-a-date");
    expect(html).toBe("<time></time>");
  });
});

describe("renderTemplate — unknown tokens", () => {
  it("renders unknown tokens as empty strings rather than leaving them literal", () => {
    const html = renderTemplate("<span>{{unknownToken}}</span>", post());
    expect(html).toBe("<span></span>");
  });
});

// The exact seeded catalog markup (sql/seeds/002_catalog_templates.sql).
// These fixtures guard against drift between the renderer's token contract
// and the app-managed templates actually stored in the database.
const ARTICLE_TEMPLATE = `<article class="tpl-article">
  <header class="tpl-article__header">
    {{#featuredImage}}
    <img class="tpl-article__hero" src="{{featuredImage}}" alt="{{title}}" />
    {{/featuredImage}}
    <h1 class="tpl-article__title">{{title}}</h1>
    <p class="tpl-article__excerpt">{{excerpt}}</p>
    <div class="tpl-article__meta">
      <time class="tpl-article__date">{{publishedAt}}</time>
      <span class="tpl-article__category">{{category}}</span>
      <span class="tpl-article__tags">{{tags}}</span>
    </div>
  </header>
  <div class="tpl-article__content">
    {{content}}
  </div>
</article>`;

const FEATURE_TEMPLATE = `<article class="tpl-feature">
  {{#featuredImage}}
  <div class="tpl-feature__hero-wrap">
    <img class="tpl-feature__hero" src="{{featuredImage}}" alt="{{title}}" />
  </div>
  {{/featuredImage}}
  <div class="tpl-feature__body">
    <header class="tpl-feature__header">
      <h1 class="tpl-feature__title">{{title}}</h1>
      <div class="tpl-feature__meta">
        <time class="tpl-feature__date">{{publishedAt}}</time>
        <span class="tpl-feature__category">{{category}}</span>
      </div>
    </header>
    <p class="tpl-feature__lede">{{excerpt}}</p>
    <div class="tpl-feature__content">
      {{content}}
    </div>
    <footer class="tpl-feature__tags">{{tags}}</footer>
  </div>
</article>`;

const PHOTO_ESSAY_TEMPLATE = `<article class="tpl-photo-essay">
  <header class="tpl-photo-essay__header">
    <h1 class="tpl-photo-essay__title">{{title}}</h1>
    <p class="tpl-photo-essay__excerpt">{{excerpt}}</p>
    <div class="tpl-photo-essay__meta">
      <time class="tpl-photo-essay__date">{{publishedAt}}</time>
      <span class="tpl-photo-essay__category">{{category}}</span>
      <span class="tpl-photo-essay__tags">{{tags}}</span>
    </div>
  </header>
  {{#featuredImage}}
  <figure class="tpl-photo-essay__figure tpl-photo-essay__figure--hero">
    <img class="tpl-photo-essay__image" src="{{featuredImage}}" alt="{{title}}" />
  </figure>
  {{/featuredImage}}
  <div class="tpl-photo-essay__content">
    {{content}}
  </div>
</article>`;

describe("renderTemplate — seeded catalog templates", () => {
  const fullPost = post({
    title: "A Full Post",
    content: "<p>Rich content</p>",
    excerpt: "An excerpt",
    featuredImageUrl: "https://example.com/hero.png",
    categoryName: "Travel",
    tags: ["one", "two"],
  });
  const sparsePost = post({
    title: "A Sparse Post",
    content: "<p>Minimal</p>",
    excerpt: undefined,
    featuredImageUrl: undefined,
    categoryName: undefined,
    tags: [],
  });

  it.each([
    ["article", ARTICLE_TEMPLATE],
    ["feature", FEATURE_TEMPLATE],
    ["photo-essay", PHOTO_ESSAY_TEMPLATE],
  ])("renders the %s template with all fields present and leaves no leftover tokens", (_key, template) => {
    const html = renderTemplate(template, fullPost, "2026-06-15T12:00:00Z");
    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
    expect(html).toContain("A Full Post");
    expect(html).toContain("https://example.com/hero.png");
  });

  it.each([
    ["article", ARTICLE_TEMPLATE],
    ["feature", FEATURE_TEMPLATE],
    ["photo-essay", PHOTO_ESSAY_TEMPLATE],
  ])("renders the %s template with all optionals missing and leaves no leftover tokens", (_key, template) => {
    const html = renderTemplate(template, sparsePost, undefined);
    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
    expect(html).toContain("A Sparse Post");
    expect(html).not.toContain("<img");
  });
});

// Every author-controlled plain-text field, rendered through every seed
// template, must come out escaped — and the (already-sanitized) rich `content`
// field must come out unchanged. This guards against a template-specific
// regression (e.g. one seed template piping a token through unescaped) that
// per-token unit tests above wouldn't catch.
describe("renderTemplate — hostile content across every seed template", () => {
  const hostilePost = post({
    title: `<script>alert('title')</script>`,
    content: '<p>Rich &amp; <b>safe</b> body</p>',
    excerpt: `"><img src=x onerror=alert('excerpt')>`,
    categoryName: `<svg onload=alert('category')>`,
    tags: [`<img src=x onerror=alert('tag')>`, `Tom & "Jerry"`],
    featuredImageUrl: "https://example.com/hero.png",
  });

  it.each([
    ["article", ARTICLE_TEMPLATE],
    ["feature", FEATURE_TEMPLATE],
    ["photo-essay", PHOTO_ESSAY_TEMPLATE],
  ])("escapes hostile title/excerpt/category/tags in the %s template", (_key, template) => {
    const html = renderTemplate(template, hostilePost, "2026-06-15T12:00:00Z");

    // No raw hostile markup made it into the output.
    expect(html).not.toContain("<script>alert('title')</script>");
    expect(html).not.toContain("onerror=alert('excerpt')");
    expect(html).not.toContain("<svg onload=alert('category')>");
    expect(html).not.toContain("onerror=alert('tag')");

    // Escaped equivalents are present instead.
    expect(html).toContain("&lt;script&gt;alert(&#39;title&#39;)&lt;/script&gt;");
    expect(html).toContain("&lt;svg onload=alert(&#39;category&#39;)&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(&#39;tag&#39;)&gt;");
    expect(html).toContain("Tom &amp; &quot;Jerry&quot;");

    // Rich `content` still passes through verbatim (sanitized at save time).
    expect(html).toContain('<p>Rich &amp; <b>safe</b> body</p>');
  });
});

describe("renderTemplate — realistic admin editor output", () => {
  // Mirrors what the admin's Tiptap editor actually produces at save time
  // (rich HTML generated by richTextJsonToHtml: paragraphs, bold/italic/
  // underline, lists, links with target/rel, and spoiler spans).
  const editorHtml =
    "<p>Hello <strong>world</strong>, some <em>emphasis</em> and <u>underline</u>.</p>" +
    '<p>A <a target="_blank" rel="noopener noreferrer" href="https://example.com/guide">link</a> ' +
    'and a <span class="spoiler">hidden twist</span>.</p>' +
    "<ul><li><p>first item</p></li><li><p>second item</p></li></ul>";

  it("inserts editor-produced rich HTML verbatim into the content slot", () => {
    const html = renderTemplate(
      '<article><h1>{{title}}</h1><div class="body">{{content}}</div></article>',
      post({ title: "Editor Post", content: editorHtml })
    );

    expect(html).toBe(
      `<article><h1>Editor Post</h1><div class="body">${editorHtml}</div></article>`
    );
    // Structure survives: nothing was escaped or re-serialized.
    expect(html).toContain("<strong>world</strong>");
    expect(html).toContain('<span class="spoiler">hidden twist</span>');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("&lt;p&gt;");
  });

  it("treats editor HTML as truthy for a {{#content}} conditional section", () => {
    const html = renderTemplate(
      "{{#content}}<section>{{content}}</section>{{/content}}",
      post({ content: editorHtml })
    );
    expect(html).toBe(`<section>${editorHtml}</section>`);
  });
});

describe("renderTemplate — hostile featuredImage variants never reach src, in every seed template", () => {
  const hostileUrls: Array<[string, string]> = [
    ["javascript: scheme", "javascript:alert(1)"],
    ["data: scheme", "data:text/html,<script>alert(1)</script>"],
    ["uppercase scheme", "JAVASCRIPT:alert(1)"],
    ["mixed-case scheme", "JaVaScRiPt:alert(1)"],
    ["tab-obfuscated scheme", "java\tscript:alert(1)"],
    ["newline-obfuscated scheme", "java\nscript:alert(1)"],
    ["leading-whitespace scheme", "   javascript:alert(1)"],
    ["vbscript scheme", "vbscript:msgbox(1)"],
  ];

  it.each([
    ["article", ARTICLE_TEMPLATE],
    ["feature", FEATURE_TEMPLATE],
    ["photo-essay", PHOTO_ESSAY_TEMPLATE],
  ])("drops every hostile featuredImage scheme from the %s template's src", (_key, template) => {
    for (const [, url] of hostileUrls) {
      const html = renderTemplate(template, post({ featuredImageUrl: url }), undefined);
      expect(html).not.toContain("javascript:");
      expect(html).not.toContain("vbscript:");
      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html).not.toContain('src="javascript');
      expect(html).not.toContain("<img");
    }
  });

  it("treats a protocol-relative featuredImage URL as a relative URL, not a scheme-based attack", () => {
    // No `scheme:` prefix means the scheme-allowlist never triggers — the
    // renderer only filters by URL *scheme*, not by host. This is not an
    // XSS vector (no script execution), just image hotlinking, so it is
    // intentionally allowed through.
    const html = renderTemplate(
      '<img src="{{featuredImage}}" />',
      post({ featuredImageUrl: "//evil.example.com/hero.png" })
    );
    expect(html).toBe('<img src="//evil.example.com/hero.png" />');
  });
});
