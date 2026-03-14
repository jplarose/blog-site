-- BlogSite Initial Schema
-- Migration: 001_initial_schema
-- Created: 2025-01-01

-- Enable UUID generation (optional, using SERIAL for simplicity)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- layout_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS layout_templates (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    html_structure  TEXT NOT NULL DEFAULT '',
    css_styles      TEXT NOT NULL DEFAULT '',
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one template can be the default
CREATE UNIQUE INDEX IF NOT EXISTS uix_layout_templates_default
    ON layout_templates (is_default)
    WHERE is_default = TRUE;

-- ============================================================
-- categories
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(200) NOT NULL,
    slug                VARCHAR(200) NOT NULL,
    description         TEXT,
    default_template_id INTEGER REFERENCES layout_templates (id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uix_categories_slug ON categories (slug);

-- ============================================================
-- posts
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
    id                  SERIAL PRIMARY KEY,
    title               VARCHAR(500) NOT NULL,
    slug                VARCHAR(500) NOT NULL,
    content             TEXT NOT NULL DEFAULT '',
    excerpt             TEXT,
    featured_image_url  TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'Draft'
                            CHECK (status IN ('Draft', 'Scheduled', 'Published', 'Archived')),
    published_at        TIMESTAMPTZ,
    scheduled_at        TIMESTAMPTZ,
    category_id         INTEGER REFERENCES categories (id) ON DELETE SET NULL,
    template_id         INTEGER REFERENCES layout_templates (id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uix_posts_slug ON posts (slug);
CREATE INDEX IF NOT EXISTS ix_posts_status ON posts (status);
CREATE INDEX IF NOT EXISTS ix_posts_published_at ON posts (published_at DESC);
CREATE INDEX IF NOT EXISTS ix_posts_category_id ON posts (category_id);

-- ============================================================
-- tags
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(200) NOT NULL,
    slug       VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uix_tags_slug ON tags (slug);

-- ============================================================
-- post_tags  (many-to-many join)
-- ============================================================
CREATE TABLE IF NOT EXISTS post_tags (
    post_id INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags  (id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

-- ============================================================
-- page_views  (analytics)
-- ============================================================
CREATE TABLE IF NOT EXISTS page_views (
    id         SERIAL PRIMARY KEY,
    post_id    INTEGER REFERENCES posts (id) ON DELETE SET NULL,
    path       VARCHAR(1000) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    referrer   TEXT,
    viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_page_views_viewed_at ON page_views (viewed_at DESC);
CREATE INDEX IF NOT EXISTS ix_page_views_post_id   ON page_views (post_id);
