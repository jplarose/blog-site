-- BlogSite Catalog Templates
-- Run after 001_seed_data.sql (and after migrations 001 -> 002 -> 003).
--
-- Purpose: seed the fixed, application-managed template catalog (issue #25).
-- These three rows are the ENTIRE catalog. They are not user-editable —
-- admins pick one of these templates for a post; they cannot create, edit,
-- or delete catalog entries via the UI/API. This script is idempotent and
-- safe to re-run: it upserts by the stable `template_key`, so reseeding
-- (e.g. on deploy) converges catalog content to what is defined here.
--
-- ============================================================
-- Template variable contract (standard placeholders)
-- ============================================================
-- Every template's html_structure MUST render all of the following
-- mustache-style placeholders (matching the convention used by the
-- retired seed template):
--
--   {{title}}          post title (plain text)
--   {{content}}         rich post body HTML (sanitized upstream by the
--                       API; templates just place it, verbatim)
--   {{excerpt}}         short summary (plain text)
--   {{featuredImage}}   hero image URL; image markup that uses it MUST be
--                       wrapped in a {{#featuredImage}}...{{/featuredImage}}
--                       conditional section so posts without a hero
--                       render cleanly (no broken/empty <img>)
--   {{publishedAt}}     display date (rendered inside a <time> element
--                       where natural)
--   {{category}}        category name
--   {{tags}}            rendered tag list
--
-- HTML/CSS quality bar:
--   - Semantic, accessible markup: <article>, heading hierarchy starting
--     at <h1> for the title, alt text on images (uses {{title}}).
--   - Responsive: fluid widths, max-width content columns, images with
--     max-width:100%; height:auto. No fixed-pixel layouts.
--   - CSS class selectors are scoped per template (.tpl-article,
--     .tpl-feature, .tpl-photo-essay) so styles cannot collide when
--     multiple templates' CSS are injected on the same page.
--   - Inert content only: no <script>, no inline event handlers, no
--     @import/url() fetches, no external assets.
--
-- ============================================================
-- Article — standard long-form post
-- ============================================================
INSERT INTO layout_templates (template_key, name, description, html_structure, css_styles)
VALUES (
    'article',
    'Article',
    'Standard long-form post layout with a hero image, title and meta, and flowing rich content. Use this as the default choice for most blog posts.',
    '<article class="tpl-article">
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
</article>',
    '.tpl-article { max-width: 720px; margin: 0 auto; padding: 2rem 1rem; }
.tpl-article__header { margin-bottom: 2rem; }
.tpl-article__hero { display: block; width: 100%; max-width: 100%; height: auto; border-radius: 0.5rem; margin-bottom: 1.5rem; }
.tpl-article__title { font-size: 2.5rem; font-weight: 700; line-height: 1.2; margin: 0 0 0.75rem; }
.tpl-article__excerpt { font-size: 1.125rem; color: #4b5563; line-height: 1.5; margin: 0 0 1rem; }
.tpl-article__meta { color: #6b7280; font-size: 0.875rem; margin-bottom: 0.5rem; }
.tpl-article__meta span + span::before,
.tpl-article__meta time + span::before { content: " \00b7 "; }
.tpl-article__content { font-size: 1.125rem; line-height: 1.75; }
.tpl-article__content h2 { font-size: 1.75rem; font-weight: 600; margin: 2rem 0 1rem; }
.tpl-article__content h3 { font-size: 1.375rem; font-weight: 600; margin: 1.5rem 0 0.75rem; }
.tpl-article__content p { margin: 0 0 1.25rem; }
.tpl-article__content pre { background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 0.375rem; overflow-x: auto; }
.tpl-article__content code { font-family: monospace; }
.tpl-article__content img { max-width: 100%; height: auto; border-radius: 0.25rem; }
@media (max-width: 640px) {
  .tpl-article { padding: 1.25rem 1rem; }
  .tpl-article__title { font-size: 1.875rem; }
}'
)
ON CONFLICT (template_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    html_structure = EXCLUDED.html_structure,
    css_styles = EXCLUDED.css_styles,
    updated_at = NOW();

-- ============================================================
-- Feature — editorial feature with full-bleed hero
-- ============================================================
INSERT INTO layout_templates (template_key, name, description, html_structure, css_styles)
VALUES (
    'feature',
    'Feature',
    'Editorial feature layout with a full-bleed hero image, an overlaid prominent title, lede/excerpt emphasis, and wider typography. Use this for flagship or spotlight stories.',
    '<article class="tpl-feature">
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
</article>',
    '.tpl-feature { width: 100%; margin: 0 auto; }
.tpl-feature__hero-wrap { position: relative; width: 100%; margin-bottom: -3rem; }
.tpl-feature__hero { display: block; width: 100%; max-width: 100%; height: auto; max-height: 70vh; object-fit: cover; }
.tpl-feature__header { position: relative; z-index: 1; margin: 0 0 1.5rem; }
.tpl-feature__hero-wrap + .tpl-feature__body .tpl-feature__header { background: rgba(255, 255, 255, 0.94); border-radius: 0.5rem; padding: 1.5rem 1.5rem 1rem; margin-top: -4rem; box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.08); }
.tpl-feature__title { font-size: 3rem; font-weight: 800; line-height: 1.1; margin: 0 0 0.5rem; }
.tpl-feature__meta { font-size: 0.9375rem; color: #6b7280; }
.tpl-feature__meta span::before { content: " \00b7 "; }
.tpl-feature__body { max-width: 840px; margin: 0 auto; padding: 2rem 1.5rem 3rem; }
.tpl-feature__lede { font-size: 1.375rem; line-height: 1.6; font-weight: 500; color: #374151; margin: 0 0 2rem; }
.tpl-feature__content { font-size: 1.1875rem; line-height: 1.85; }
.tpl-feature__content h2 { font-size: 2rem; font-weight: 700; margin: 2.5rem 0 1.25rem; }
.tpl-feature__content h3 { font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem; }
.tpl-feature__content p { margin: 0 0 1.5rem; }
.tpl-feature__content img { max-width: 100%; height: auto; border-radius: 0.25rem; }
.tpl-feature__content pre { background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 0.375rem; overflow-x: auto; }
.tpl-feature__content code { font-family: monospace; }
.tpl-feature__tags { margin-top: 2rem; font-size: 0.875rem; color: #6b7280; }
@media (max-width: 640px) {
  .tpl-feature__title { font-size: 2rem; }
  .tpl-feature__lede { font-size: 1.1875rem; }
  .tpl-feature__body { padding: 1.5rem 1rem 2rem; }
}'
)
ON CONFLICT (template_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    html_structure = EXCLUDED.html_structure,
    css_styles = EXCLUDED.css_styles,
    updated_at = NOW();

-- ============================================================
-- Photo Essay — image-forward layout
-- ============================================================
INSERT INTO layout_templates (template_key, name, description, html_structure, css_styles)
VALUES (
    'photo-essay',
    'Photo Essay',
    'Image-forward layout with large imagery, generous whitespace, and a captions-style content flow. Use this for photo-driven storytelling where images carry the narrative.',
    '<article class="tpl-photo-essay">
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
</article>',
    '.tpl-photo-essay { max-width: 900px; margin: 0 auto; padding: 3rem 1.5rem; }
.tpl-photo-essay__header { max-width: 640px; margin: 0 auto 3rem; text-align: center; }
.tpl-photo-essay__title { font-size: 2.25rem; font-weight: 700; line-height: 1.25; margin: 0 0 1rem; }
.tpl-photo-essay__excerpt { font-size: 1.125rem; color: #4b5563; line-height: 1.6; margin: 0 0 1rem; }
.tpl-photo-essay__meta { color: #6b7280; font-size: 0.875rem; }
.tpl-photo-essay__meta span + span::before,
.tpl-photo-essay__meta time + span::before { content: " \00b7 "; }
.tpl-photo-essay__figure { margin: 0 0 3rem; }
.tpl-photo-essay__figure--hero { margin-bottom: 3.5rem; }
.tpl-photo-essay__image { display: block; width: 100%; max-width: 100%; height: auto; border-radius: 0.25rem; }
.tpl-photo-essay__content { font-size: 1.125rem; line-height: 1.9; }
.tpl-photo-essay__content p { max-width: 640px; margin: 0 auto 1.75rem; }
.tpl-photo-essay__content h2 { font-size: 1.75rem; font-weight: 600; margin: 3rem auto 1.25rem; max-width: 640px; }
.tpl-photo-essay__content h3 { font-size: 1.375rem; font-weight: 600; margin: 2rem auto 1rem; max-width: 640px; }
.tpl-photo-essay__content img { display: block; width: 100%; max-width: 100%; height: auto; margin: 0 auto 3rem; border-radius: 0.25rem; }
.tpl-photo-essay__content figcaption { text-align: center; font-size: 0.9375rem; color: #6b7280; margin-top: -2rem; margin-bottom: 3rem; }
.tpl-photo-essay__content pre { background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 0.375rem; overflow-x: auto; max-width: 640px; margin: 0 auto 1.75rem; }
.tpl-photo-essay__content code { font-family: monospace; }
@media (max-width: 640px) {
  .tpl-photo-essay { padding: 2rem 1rem; }
  .tpl-photo-essay__title { font-size: 1.75rem; }
}'
)
ON CONFLICT (template_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    html_structure = EXCLUDED.html_structure,
    css_styles = EXCLUDED.css_styles,
    updated_at = NOW();
