-- BlogSite Seed Data
-- Run after 001_initial_schema.sql, 002_template_layout_json.sql,
-- and 003_fixed_template_catalog_reset.sql.
--
-- Note: the old "Default" layout_templates INSERT that used to live here
-- was removed (issue #25) because it referenced columns (layout_json,
-- is_default) dropped by migration 003. The fixed catalog templates are
-- now seeded by seeds/002_catalog_templates.sql.

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
