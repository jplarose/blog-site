import type { TemplateSummary } from "@/lib/catalog";

interface TemplateCardsProps {
  templates: TemplateSummary[];
  selectedTemplateId: string;
  onSelect: (templateId: string) => void;
  disabled?: boolean;
}

/**
 * Radio-group of the fixed catalog templates (Article, Feature, Photo
 * Essay). Exactly one must be selected before a post can be saved.
 */
export default function TemplateCards({
  templates,
  selectedTemplateId,
  onSelect,
  disabled = false,
}: TemplateCardsProps) {
  if (templates.length === 0) {
    return <p className="text-sm text-gray-500">No templates are available.</p>;
  }

  return (
    <div role="radiogroup" aria-label="Template" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {templates.map((template) => {
        const inputId = `template-card-${template.id}`;
        const isSelected = selectedTemplateId === String(template.id);

        return (
          <label
            key={template.id}
            htmlFor={inputId}
            className={`rounded-xl border-2 p-4 transition-colors ${
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            } ${
              isSelected
                ? "border-indigo-600 bg-indigo-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <input
              id={inputId}
              type="radio"
              name="template"
              value={template.id}
              aria-label={template.name}
              checked={isSelected}
              onChange={() => onSelect(String(template.id))}
              disabled={disabled}
              className="sr-only"
            />
            <p className="font-semibold text-gray-900">{template.name}</p>
            {template.description ? (
              <p className="mt-1 text-sm text-gray-500">{template.description}</p>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}
