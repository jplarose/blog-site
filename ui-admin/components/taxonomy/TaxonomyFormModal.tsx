"use client";

import { useState } from "react";

import Modal from "@/components/ui/Modal";
import { slugify } from "@/lib/taxonomy/slugify";

export interface TaxonomyFormValues {
  name: string;
  slug: string;
  description?: string;
}

interface TaxonomyFormModalProps {
  mode: "create" | "edit";
  /** Lowercase noun used in copy, e.g. "category" or "tag". */
  entityLabel: string;
  initialValues: TaxonomyFormValues;
  /** Categories show a description textarea; tags don't have the field. */
  showDescription: boolean;
  isSubmitting: boolean;
  serverError: string | null;
  onCancel: () => void;
  onSubmit: (values: TaxonomyFormValues) => void;
}

/**
 * Shared create/edit form for categories and tags. Modal chrome (focus
 * trap, focus restore, background inert) lives in the shared `Modal`
 * component; this only owns the form fields and client-side validation.
 * On create, the slug field auto-fills from the name until the user edits
 * it by hand — editing an existing item never overwrites its slug.
 */
export default function TaxonomyFormModal({
  mode,
  entityLabel,
  initialValues,
  showDescription,
  isSubmitting,
  serverError,
  onCancel,
  onSubmit,
}: TaxonomyFormModalProps) {
  const [name, setName] = useState(initialValues.name);
  const [slug, setSlug] = useState(initialValues.slug);
  const [description, setDescription] = useState(initialValues.description ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    if (mode === "create" && !slugTouched) {
      setSlug(slugify(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlugTouched(true);
    setSlug(value);
  }

  function handleSubmit() {
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();
    if (!trimmedName || !trimmedSlug) {
      setValidationError(`${capitalize(entityLabel)} name and slug are required.`);
      return;
    }
    setValidationError(null);
    onSubmit(
      showDescription
        ? { name: trimmedName, slug: trimmedSlug, description: description.trim() }
        : { name: trimmedName, slug: trimmedSlug },
    );
  }

  const errorMessage = validationError ?? serverError;
  const headingId = "taxonomy-form-title";
  const submitLabel = isSubmitting
    ? "Saving…"
    : mode === "create"
      ? `Create ${entityLabel}`
      : `Save ${entityLabel}`;

  return (
    <Modal labelledBy={headingId} onClose={onCancel}>
      <h2 id={headingId} className="text-lg font-semibold text-gray-900">
        {mode === "create" ? `New ${capitalize(entityLabel)}` : `Edit ${capitalize(entityLabel)}`}
      </h2>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="taxonomy-name" className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            id="taxonomy-name"
            type="text"
            value={name}
            onChange={(event) => handleNameChange(event.target.value)}
            disabled={isSubmitting}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="taxonomy-slug" className="block text-sm font-medium text-gray-700">
            Slug
          </label>
          <input
            id="taxonomy-slug"
            type="text"
            value={slug}
            onChange={(event) => handleSlugChange(event.target.value)}
            disabled={isSubmitting}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-400">Lowercase letters, digits, and hyphens only.</p>
        </div>

        {showDescription ? (
          <div>
            <label htmlFor="taxonomy-description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="taxonomy-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSubmitting}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </div>
    </Modal>
  );
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}
