"use client";

import { useEffect, useState } from "react";

import ConfirmDeleteTaxonomyDialog from "@/components/taxonomy/ConfirmDeleteTaxonomyDialog";
import TaxonomyFormModal, { type TaxonomyFormValues } from "@/components/taxonomy/TaxonomyFormModal";
import TaxonomyTable from "@/components/taxonomy/TaxonomyTable";
import { ApiError, tagsApi, type Tag } from "@/lib/api";
import { friendlyErrorMessage, staleRowMessage } from "@/lib/taxonomy/errorMessage";

type DialogState =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; tag: Tag }
  | { kind: "delete"; tag: Tag };

/**
 * Full CRUD workspace for tags: list with loading/empty/error states, a
 * create/edit form modal, and a delete-confirmation modal that surfaces the
 * referenced-by-posts conflict distinctly from a duplicate-on-save
 * conflict. Mirrors `CategoriesManager` but tags have no description field.
 */
export default function TagsManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  // Delete's only Conflict outcome is "still referenced by posts" (see
  // TagsController.MapFailure), so a 409 here is unambiguous. The in-use
  // count is built from the row's own `postCount` rather than re-parsing
  // the API's generic message, keeping this message visibly distinct from
  // the duplicate-name/slug 409 shown on save.
  const [deleteConflict, setDeleteConflict] = useState(false);
  // Surfaces the "row no longer exists" case for an update/delete that 404s
  // because someone else deleted it between the list load and the action.
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadTags() {
      setIsLoading(true);
      setListError(null);
      try {
        const result = await tagsApi.list();
        if (isActive) setTags(result);
      } catch (error) {
        if (!isActive) return;
        setTags([]);
        setListError(error instanceof Error ? error.message : "Failed to load tags.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadTags();
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
      const created = await tagsApi.create({ name: values.name, slug: values.slug });
      setTags((current) => [...current, created]);
      closeDialog();
    } catch (error) {
      setDialogError(friendlyErrorMessage(error, "Failed to create the tag."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdate(tag: Tag, values: TaxonomyFormValues) {
    setIsSubmitting(true);
    setDialogError(null);
    try {
      const updated = await tagsApi.update(tag.id, { name: values.name, slug: values.slug });
      setTags((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      closeDialog();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // The row was deleted elsewhere between the list load and this
        // edit; drop it locally and tell the user instead of showing a
        // dead-end "not found" error on a form for a row that's gone.
        setTags((current) => current.filter((item) => item.id !== tag.id));
        closeDialog();
        setNotice(staleRowMessage("tag", tag.name));
      } else {
        setDialogError(friendlyErrorMessage(error, "Failed to update the tag."));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(tag: Tag) {
    setIsSubmitting(true);
    setDialogError(null);
    setDeleteConflict(false);
    try {
      await tagsApi.delete(tag.id);
      setTags((current) => current.filter((item) => item.id !== tag.id));
      closeDialog();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setDeleteConflict(true);
      } else if (error instanceof ApiError && error.status === 404) {
        // Already gone — the delete the user wanted is effectively done.
        setTags((current) => current.filter((item) => item.id !== tag.id));
        closeDialog();
        setNotice(staleRowMessage("tag", tag.name));
      } else {
        setDialogError(friendlyErrorMessage(error, "Failed to delete the tag."));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tags</h1>
          <p className="mt-1 text-sm text-gray-500">Manage tags used across your blog posts</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setDialog({ kind: "create" });
          }}
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
        >
          + New Tag
        </button>
      </div>

      <div aria-live="polite" className="sr-only">
        {notice}
      </div>

      {notice ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{notice}</div>
      ) : null}

      {listError ? (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {listError}
        </div>
      ) : (
        <TaxonomyTable
          entityLabel="tag"
          rows={tags}
          isLoading={isLoading}
          showDescription={false}
          onEdit={(row) => {
            const tag = tags.find((item) => item.id === row.id);
            if (tag) {
              setNotice(null);
              setDialog({ kind: "edit", tag });
            }
          }}
          onDelete={(row) => {
            const tag = tags.find((item) => item.id === row.id);
            if (tag) {
              setNotice(null);
              setDialog({ kind: "delete", tag });
            }
          }}
        />
      )}

      {dialog.kind === "create" ? (
        <TaxonomyFormModal
          mode="create"
          entityLabel="tag"
          initialValues={{ name: "", slug: "" }}
          showDescription={false}
          isSubmitting={isSubmitting}
          serverError={dialogError}
          onCancel={closeDialog}
          onSubmit={(values) => void handleCreate(values)}
        />
      ) : null}

      {dialog.kind === "edit" ? (
        <TaxonomyFormModal
          mode="edit"
          entityLabel="tag"
          initialValues={{ name: dialog.tag.name, slug: dialog.tag.slug }}
          showDescription={false}
          isSubmitting={isSubmitting}
          serverError={dialogError}
          onCancel={closeDialog}
          onSubmit={(values) => void handleUpdate(dialog.tag, values)}
        />
      ) : null}

      {dialog.kind === "delete" ? (
        <ConfirmDeleteTaxonomyDialog
          entityLabel="tag"
          itemName={dialog.tag.name}
          isSubmitting={isSubmitting}
          serverError={dialogError}
          referencedByPostCount={deleteConflict ? dialog.tag.postCount : undefined}
          onCancel={closeDialog}
          onConfirm={() => void handleDelete(dialog.tag)}
        />
      ) : null}
    </div>
  );
}
