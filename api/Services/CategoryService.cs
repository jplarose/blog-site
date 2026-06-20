using BlogSite.Api.Data;
using BlogSite.Api.DTOs;
using BlogSite.Api.Models;
using BlogSite.Api.Results;
using Microsoft.EntityFrameworkCore;

namespace BlogSite.Api.Services;

public class CategoryService(BlogDbContext db)
{
    public async Task<Result<Category>> CreateAsync(
        CreateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<Category>.Failure("category.name_required", "Category name is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Slug))
        {
            return Result<Category>.Failure("category.slug_required", "Category slug is required.");
        }

        var category = new Category
        {
            Name = request.Name.Trim(),
            Slug = request.Slug.Trim(),
            Description = request.Description,
            DefaultTemplateId = request.DefaultTemplateId
        };

        db.Categories.Add(category);
        await db.SaveChangesAsync(cancellationToken);
        await db.Entry(category).Reference(c => c.DefaultTemplate).LoadAsync(cancellationToken);

        return Result<Category>.Success(category);
    }

    public async Task<Result<Category>> UpdateAsync(
        int id,
        UpdateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var category = await db.Categories
            .Include(c => c.DefaultTemplate)
            .Include(c => c.Posts)
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        if (category is null)
        {
            return Result<Category>.Failure("category.not_found", "Category was not found.");
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<Category>.Failure("category.name_required", "Category name is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Slug))
        {
            return Result<Category>.Failure("category.slug_required", "Category slug is required.");
        }

        category.Name = request.Name.Trim();
        category.Slug = request.Slug.Trim();
        category.Description = request.Description;
        category.DefaultTemplateId = request.DefaultTemplateId;
        category.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
        await db.Entry(category).Reference(c => c.DefaultTemplate).LoadAsync(cancellationToken);

        return Result<Category>.Success(category);
    }

    public async Task<Result> DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var category = await db.Categories.FindAsync([id], cancellationToken);
        if (category is null)
        {
            return Result.Failure("category.not_found", "Category was not found.");
        }

        db.Categories.Remove(category);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
