-- Purpose: add JSON-backed storage for template layouts and post template content
-- Runtime/locking: fast metadata changes plus table updates proportional to existing layout_templates rows
-- Rollback: drop posts.template_content and layout_templates.layout_json after confirming no code depends on them

ALTER TABLE layout_templates
    ADD COLUMN IF NOT EXISTS layout_json JSONB;

UPDATE layout_templates
SET layout_json = CASE
    WHEN NULLIF(BTRIM(html_structure), '') IS NOT NULL
         AND LEFT(BTRIM(html_structure), 1) = '{'
        THEN html_structure::jsonb
    ELSE '{
      "version": 1,
      "canvas": { "width": 960, "minRowHeight": 120 },
      "rootBlockIds": [],
      "blocks": {}
    }'::jsonb
END
WHERE layout_json IS NULL;

ALTER TABLE layout_templates
    ALTER COLUMN layout_json SET DEFAULT '{
      "version": 1,
      "canvas": { "width": 960, "minRowHeight": 120 },
      "rootBlockIds": [],
      "blocks": {}
    }'::jsonb;

UPDATE layout_templates
SET layout_json = COALESCE(
    layout_json,
    '{
      "version": 1,
      "canvas": { "width": 960, "minRowHeight": 120 },
      "rootBlockIds": [],
      "blocks": {}
    }'::jsonb
);

ALTER TABLE layout_templates
    ALTER COLUMN layout_json SET NOT NULL;

ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS template_content JSONB;
