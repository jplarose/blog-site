"use client";

import { useEffect, useState } from "react";

import ConfirmDeleteTaxonomyDialog from "@/components/taxonomy/ConfirmDeleteTaxonomyDialog";
import TaxonomyFormModal, { type TaxonomyFormValues } from "@/components/taxonomy/TaxonomyFormModal";
import TaxonomyTable from "@/components/taxonomy/TaxonomyTable";
import { ApiError, categoriesApi, type Category } from "@/lib/api";
import { friendlyErrorMessage } from "@/lib/taxonomy/errorMessage";

type DialogState =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; category: Category }
  | { kind: "delete"; category: Category };

/**
 * Full CRUD workspace for categories: list with loading/empty/error states,
 * a create/edit form modal, and a delete-confirmation modal that surfaces
 * the referenced-by-posts conflict distinctly from a duplicate-on-save
 * conflict. Categories no longer carry a default-template concept (removed
 * in #32) so this intentionally has no template copy or column.
 */
export default function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  // Delete's only Conflict outcome is "still referenced by posts" (see
  // CategoriesController.MapFailure), so a 409 here is unambiguous. The
  // in-use count is built from the row's own `postCount` rather than
  // re-parsing the API's generic message, keeping this message visibly
  // distinct from the duplicate-name/slug 409 shown on save.
  const [deleteConflict, setDeleteConflict] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadCategories() {
      setIsLoading(true);
      setListError(null);
      try {
        const result = await categoriesApi.list();
        if (isActive) setCategories(result);
      } catch (error) {
        if (!isActive) return;
        setCategories([]);
        setListError(error instanceof Error ? error.message : "Failed to load categories.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadCategories();
    return () => {
      isActive = false;
    };
  }, []);

  function closeDialog() {
    setDialog({ kind: "none" });
    setDialogError(null);
    setDeleteConflict(false);
  }

  async function handleCreate(values: TaxonomyFormValues) {
    setIsSubmitting(true);
    setDialogError(null);
    try {
      const created = await categoriesApi.create(values);
      setCategories((current) => [...current, created]);
      closeDialog();
    } catch (error) {
      setDialogError(friendlyErrorMessage(error, "Failed to create the category."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdate(category: Category, values: TaxonomyFormValues) {
    setIsSubmitting(true);
    setDialogError(null);
    try {
      const updated = await categoriesApi.update(category.id, values);
      setCategories((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      closeDialog();
    } catch (error) {
      setDialogError(friendlyErrorMessage(error, "Failed to update the category."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(category: Category) {
    setIsSubmitting(true);
    setDialogError(null);
    setDeleteConflict(false);
    try {
      await categoriesApi.delete(category.id);
      setCategories((current) => current.filter((item) => item.id !== category.id));
      closeDialog();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setDeleteConflict(true);
      } else {
        setDialogError(friendlyErrorMessage(error, "Failed to delete the category."));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="mt-1 text-sm text-gray-500">Organize your content into categories</p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ kind: "create" })}
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
        >
          + New Category
        </button>
      </div>

      {listError ? (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {listError}
        </div>
      ) : (
        <TaxonomyTable
          entityLabel="category"
          rows={categories}
          isLoading={isLoading}
          showDescription
          onEdit={(row) => {
            const category = categories.find((item) => item.id === row.id);
            if (category) setDialog({ kind: "edit", category });
          }}
          onDelete={(row) => {
            const category = categories.find((item) => item.id === row.id);
            if (category) setDialog({ kind: "delete", category });
          }}
        />
      )}

      {dialog.kind === "create" ? (
        <TaxonomyFormModal
          mode="create"
          entityLabel="category"
          initialValues={{ name: "", slug: "", description: "" }}
          showDescription
          isSubmitting={isSubmitting}
          serverError={dialogError}
          onCancel={closeDialog}
          onSubmit={(values) => void handleCreate(values)}
        />
      ) : null}

      {dialog.kind === "edit" ? (
        <TaxonomyFormModal
          mode="edit"
          entityLabel="category"
          initialValues={{
            name: dialog.category.name,
            slug: dialog.category.slug,
            description: dialog.category.description ?? "",
          }}
          showDescription
          isSubmitting={isSubmitting}
          serverError={dialogError}
          onCancel={closeDialog}
          onSubmit={(values) => void handleUpdate(dialog.category, values)}
        />
      ) : null}

      {dialog.kind === "delete" ? (
        <ConfirmDeleteTaxonomyDialog
          entityLabel="category"
          itemName={dialog.category.name}
          isSubmitting={isSubmitting}
          serverError={dialogError}
          referencedByPostCount={deleteConflict ? dialog.category.postCount : undefined}
          onCancel={closeDialog}
          onConfirm={() => void handleDelete(dialog.category)}
        />
      ) : null}
    </div>
  );
}
