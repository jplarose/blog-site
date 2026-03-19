import TemplateEditorForm from "@/components/template-editor/TemplateEditorForm";
import { templatesApi } from "@/lib/api";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await templatesApi.get(Number(id));

  return <TemplateEditorForm mode="edit" initialTemplate={template} />;
}
