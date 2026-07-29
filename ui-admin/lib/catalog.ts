/**
 * Client types for the fixed, read-only layout-template catalog (issue #30).
 * The catalog has exactly three entries (Article, Feature, Photo Essay);
 * admins pick one per post but cannot create, edit, or delete entries.
 */

/** List view of a catalog template, as returned by `GET /api/layouttemplates`. */
export interface TemplateSummary {
  id: number;
  templateKey: string;
  name: string;
  description?: string;
}

/** Full catalog template, as returned by `GET /api/layouttemplates/{id}`. */
export interface CatalogTemplate extends TemplateSummary {
  htmlStructure: string;
  cssStyles: string;
}
