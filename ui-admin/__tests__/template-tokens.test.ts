import { describe, expect, it } from "vitest";

import { renderTemplateHtml, type TemplateTokenValues } from "@/lib/template-tokens";

function values(overrides: Partial<TemplateTokenValues> = {}): TemplateTokenValues {
  return {
    title: "Hello World",
    content: "<p>Body</p>",
    excerpt: "A short summary",
    featuredImage: "",
    publishedAt: "",
    category: "",
    tags: "",
    ...overrides,
  };
}

describe("renderTemplateHtml", () => {
  it("substitutes plain-text tokens with escaped values", () => {
    const html = renderTemplateHtml("<h1>{{title}}</h1>", values({ title: "<script>x</script>" }));

    expect(html).toBe("<h1>&lt;script&gt;x&lt;/script&gt;</h1>");
  });

  it("substitutes the content token as raw, unescaped HTML", () => {
    const html = renderTemplateHtml("<div>{{content}}</div>", values({ content: "<p>Rich <b>body</b></p>" }));

    expect(html).toBe("<div><p>Rich <b>body</b></p></div>");
  });

  it("replaces every occurrence of a repeated token", () => {
    const html = renderTemplateHtml("{{title}} / {{title}}", values({ title: "Post" }));

    expect(html).toBe("Post / Post");
  });

  it("keeps a conditional section when its value is non-empty", () => {
    const template = '{{#featuredImage}}<img src="{{featuredImage}}" />{{/featuredImage}}';
    const html = renderTemplateHtml(template, values({ featuredImage: "https://example.com/hero.png" }));

    expect(html).toBe('<img src="https://example.com/hero.png" />');
  });

  it("removes a conditional section when its value is empty", () => {
    const template = 'before{{#featuredImage}}<img src="{{featuredImage}}" />{{/featuredImage}}after';
    const html = renderTemplateHtml(template, values({ featuredImage: "" }));

    expect(html).toBe("beforeafter");
  });

  it("removes a conditional section when its value is only whitespace", () => {
    const template = '{{#excerpt}}<p>{{excerpt}}</p>{{/excerpt}}';
    const html = renderTemplateHtml(template, values({ excerpt: "   " }));

    expect(html).toBe("");
  });

  it("renders unknown tokens as empty strings", () => {
    const html = renderTemplateHtml("<span>{{unknownToken}}</span>", values());

    expect(html).toBe("<span></span>");
  });

  it("renders a full article template with mixed fields present and absent", () => {
    const template =
      '<article>{{#featuredImage}}<img src="{{featuredImage}}" alt="{{title}}" />{{/featuredImage}}<h1>{{title}}</h1><div>{{content}}</div></article>';

    const html = renderTemplateHtml(
      template,
      values({ title: "My Post", content: "<p>Text</p>", featuredImage: "" }),
    );

    expect(html).toBe("<article><h1>My Post</h1><div><p>Text</p></div></article>");
  });
});
