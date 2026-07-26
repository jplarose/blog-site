-- ============================================================
-- ⚠️  DESTRUCTIVE — DEVELOPMENT ONLY  ⚠️
-- ============================================================
-- Purpose: reset the schema for the fixed, database-seeded template
-- catalog (issue #24). Removes the old user-editable template data
-- structures (layout_json, template_content, is_default, category
-- default templates) and reshapes layout_templates into a catalog
-- keyed by a stable template_key. The three catalog templates
-- (Article, Feature, Photo Essay) are seeded by a LATER migration/seed
-- task — this migration intentionally leaves layout_templates empty.
--
-- THIS MIGRATION DELETES ALL ROWS FROM: page_views, post_tags, posts,
-- layout_templates. Do NOT run against a database containing data you
-- want to keep. Intended only for disposable development databases.
--
-- Rollback: there is no in-place rollback — restore from a backup
-- taken before running this migration, or re-create the dev database
-- from scratch (run 001 → 002 → seeds again).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Delete data, in dependency-safe order (children before parents)
-- ------------------------------------------------------------
DELETE FROM page_views;
DELETE FROM post_tags;
DELETE FROM posts;
DELETE FROM layout_templates;

-- ------------------------------------------------------------
-- 2. Remove category-level template defaults
-- ------------------------------------------------------------
ALTER TABLE categories
    DROP COLUMN IF EXISTS default_template_id;

-- ------------------------------------------------------------
-- 3. Remove editable-template data structures from posts
-- ------------------------------------------------------------
ALTER TABLE posts
    DROP COLUMN IF EXISTS template_content;

-- ------------------------------------------------------------
-- 4. Reshape layout_templates into a fixed catalog
-- ------------------------------------------------------------
-- Drop the "default template" concept — the catalog has no default;
-- posts explicitly select a template.
DROP INDEX IF EXISTS uix_layout_templates_default;

ALTER TABLE layout_templates
    DROP COLUMN IF EXISTS is_default;

ALTER TABLE layout_templates
    DROP COLUMN IF EXISTS layout_json;

-- Add the stable catalog key. The table was emptied above, so NOT NULL
-- can be added directly without needing a default value.
ALTER TABLE layout_templates
    ADD COLUMN IF NOT EXISTS template_key VARCHAR(100) NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uix_layout_templates_template_key
    ON layout_templates (template_key);

-- html_structure and css_styles are retained: the fixed catalog stores
-- trusted HTML/CSS markup in these columns.
