using BlogSite.Api.DTOs;
using BlogSite.Api.Repositories;
using BlogSite.Api.Results;

namespace BlogSite.Api.Services;

public class LayoutTemplateService(ILayoutTemplateRepository templates)
{
    public async Task<Result<LayoutTemplateDto>> CreateAsync(
        CreateLayoutTemplateRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<LayoutTemplateDto>.Failure(
                "template.name_required",
                "Template name is required.");
        }

        var template = await templates.CreateAsync(
            request.Name.Trim(),
            request.Description,
            request.Layout,
            request.IsDefault,
            cancellationToken);

        return Result<LayoutTemplateDto>.Success(template);
    }

    public async Task<Result<LayoutTemplateDto>> UpdateAsync(
        int id,
        UpdateLayoutTemplateRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<LayoutTemplateDto>.Failure(
                "template.name_required",
                "Template name is required.");
        }

        var template = await templates.UpdateAsync(
            id,
            request.Name.Trim(),
            request.Description,
            request.Layout,
            request.IsDefault,
            cancellationToken);

        return template is null
            ? Result<LayoutTemplateDto>.Failure(
                "template.not_found",
                "Template was not found.")
            : Result<LayoutTemplateDto>.Success(template);
    }

    public async Task<Result> DeleteAsync(
        int id,
        CancellationToken cancellationToken)
    {
        var deleted = await templates.DeleteAsync(id, cancellationToken);
        return deleted
            ? Result.Success()
            : Result.Failure("template.not_found", "Template was not found.");
    }
}
