using BlogSite.Api.DTOs;
using BlogSite.Api.Repositories;
using BlogSite.Api.Results;
using BlogSite.Api.Validation;
using Npgsql;

namespace BlogSite.Api.Services;

public class CategoryService(ICategoryRepository categories)
{
    private const string UniqueViolationSqlState = "23505";

    public async Task<Result<CategoryDto>> CreateAsync(
        CreateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var validation = await ValidateAsync(
            request.Name,
            request.Slug,
            excludeId: null,
            cancellationToken);
        if (validation is not null)
        {
            return validation;
        }

        var name = request.Name.Trim();
        var slug = request.Slug.Trim();

        try
        {
            var category = await categories.CreateAsync(
                name,
                slug,
                request.Description,
                cancellationToken);

            return Result<CategoryDto>.Success(category);
        }
        catch (PostgresException ex) when (ex.SqlState == UniqueViolationSqlState)
        {
            // Safety net for a race between the pre-check above and this
            // insert: the DB's unique index on slug is the source of truth.
            return DuplicateSlugFailure();
        }
    }

    public async Task<Result<CategoryDto>> UpdateAsync(
        int id,
        UpdateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var validation = await ValidateAsync(
            request.Name,
            request.Slug,
            excludeId: id,
            cancellationToken);
        if (validation is not null)
        {
            return validation;
        }

        var name = request.Name.Trim();
        var slug = request.Slug.Trim();

        CategoryDto? category;
        try
        {
            category = await categories.UpdateAsync(
                id,
                name,
                slug,
                request.Description,
                cancellationToken);
        }
        catch (PostgresException ex) when (ex.SqlState == UniqueViolationSqlState)
        {
            return DuplicateSlugFailure();
        }

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
        // Admin-only path: count posts of every status so a category
        // referenced by drafts/scheduled posts still refuses deletion.
        var existing = await categories.GetByIdAsync(
            id,
            publishedOnly: false,
            cancellationToken);
        if (existing is null)
        {
            return Result.Failure("category.not_found", "Category was not found.");
        }

        if (existing.PostCount > 0)
        {
            return Result.Failure(
                "category.referenced",
                "Category cannot be deleted because it is still referenced by posts.");
        }

        var deleted = await categories.DeleteAsync(id, cancellationToken);
        return deleted
            ? Result.Success()
            : Result.Failure("category.not_found", "Category was not found.");
    }

    private async Task<Result<CategoryDto>?> ValidateAsync(
        string name,
        string slug,
        int? excludeId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result<CategoryDto>.Failure(
                "category.name_required",
                "Category name is required.");
        }

        if (string.IsNullOrWhiteSpace(slug))
        {
            return Result<CategoryDto>.Failure(
                "category.slug_required",
                "Category slug is required.");
        }

        var trimmedSlug = slug.Trim();
        if (!SlugValidator.IsUrlSafe(trimmedSlug))
        {
            return Result<CategoryDto>.Failure(
                "category.slug_invalid",
                "Category slug must contain only lowercase letters, digits, and hyphens.");
        }

        var trimmedName = name.Trim();
        if (await categories.NameExistsAsync(trimmedName, excludeId, cancellationToken))
        {
            return Result<CategoryDto>.Failure(
                "category.duplicate_name",
                "A category with this name already exists.");
        }

        if (await categories.SlugExistsAsync(trimmedSlug, excludeId, cancellationToken))
        {
            return DuplicateSlugFailure();
        }

        return null;
    }

    private static Result<CategoryDto> DuplicateSlugFailure() =>
        Result<CategoryDto>.Failure(
            "category.duplicate_slug",
            "A category with this slug already exists.");
}
