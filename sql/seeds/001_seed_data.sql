-- BlogSite Seed Data
-- Run after 001_initial_schema.sql

-- ============================================================
-- Default layout template
-- ============================================================
INSERT INTO layout_templates (name, description, html_structure, css_styles, is_default)
VALUES (
    'Default',
    'The default blog post layout with header, content, and footer.',
    '<article class="post">
  <header class="post-header">
    <h1 class="post-title">{{title}}</h1>
    <div class="post-meta">
      <span class="post-date">{{publishedAt}}</span>
      <span class="post-category">{{category}}</span>
      <span class="post-tags">{{tags}}</span>
    </div>
    {{#featuredImage}}
    <img class="post-featured-image" src="{{featuredImage}}" alt="{{title}}" />
    {{/featuredImage}}
  </header>
  <div class="post-content">
    {{content}}
  </div>
</article>',
    '.post { max-width: 800px; margin: 0 auto; padding: 2rem 1rem; }
.post-header { margin-bottom: 2rem; }
.post-title { font-size: 2.5rem; font-weight: 700; line-height: 1.2; margin-bottom: 0.5rem; }
.post-meta { color: #6b7280; font-size: 0.875rem; margin-bottom: 1rem; }
.post-meta span + span::before { content: " · "; }
.post-featured-image { width: 100%; height: auto; border-radius: 0.5rem; margin-bottom: 1.5rem; }
.post-content { font-size: 1.125rem; line-height: 1.75; }
.post-content h2 { font-size: 1.75rem; font-weight: 600; margin: 2rem 0 1rem; }
.post-content h3 { font-size: 1.375rem; font-weight: 600; margin: 1.5rem 0 0.75rem; }
.post-content p  { margin-bottom: 1.25rem; }
.post-content pre { background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 0.375rem; overflow-x: auto; }
.post-content code { font-family: monospace; }
.post-content img { max-width: 100%; height: auto; border-radius: 0.25rem; }',
    TRUE
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Sample categories
-- ============================================================
INSERT INTO categories (name, slug, description)
VALUES
    ('Technology', 'technology', 'Posts about software, hardware, and the tech industry.'),
    ('Tutorials',  'tutorials',  'Step-by-step guides and how-to articles.'),
    ('General',    'general',    'Miscellaneous posts that do not fit other categories.')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Sample tags
-- ============================================================
INSERT INTO tags (name, slug)
VALUES
    ('JavaScript', 'javascript'),
    ('TypeScript', 'typescript'),
    ('Next.js',    'nextjs'),
    ('.NET',       'dotnet'),
    ('PostgreSQL', 'postgresql'),
    ('CSS',        'css'),
    ('Open Source','open-source')
ON CONFLICT DO NOTHING;
