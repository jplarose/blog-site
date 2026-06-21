using BlogSite.Api.DTOs;
using BlogSite.Api.Repositories;
using BlogSite.Api.Results;

namespace BlogSite.Api.Services;

public class CategoryService(ICategoryRepository categories)
{
    public async Task<Result<CategoryDto>> CreateAsync(
        CreateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<CategoryDto>.Failure(
                "category.name_required",
                "Category name is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Slug))
        {
            return Result<CategoryDto>.Failure(
                "category.slug_required",
                "Category slug is required.");
        }

        var category = await categories.CreateAsync(
            request.Name.Trim(),
            request.Slug.Trim(),
            request.Description,
            request.DefaultTemplateId,
            cancellationToken);

        return Result<CategoryDto>.Success(category);
    }

    public async Task<Result<CategoryDto>> UpdateAsync(
        int id,
        UpdateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<CategoryDto>.Failure(
                "category.name_required",
                "Category name is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Slug))
        {
            return Result<CategoryDto>.Failure(
                "category.slug_required",
                "Category slug is required.");
        }

        var category = await categories.UpdateAsync(
            id,
            request.Name.Trim(),
            request.Slug.Trim(),
            request.Description,
            request.DefaultTemplateId,
            cancellationToken);

        return category is null
            ? Result<CategoryDto>.Failure(
                "category.not_found",
                "Category was not found.")
            : Result<CategoryDto>.Success(category);
    }

    public async Task<Result> DeleteAsync(
        int id,
        CancellationToken cancellationToken)
    {
        var deleted = await categories.DeleteAsync(id, cancellationToken);
        return deleted
            ? Result.Success()
            : Result.Failure("category.not_found", "Category was not found.");
    }
}
