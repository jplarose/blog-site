using BlogSite.Api.Data;
using BlogSite.Api.DTOs;
using BlogSite.Api.Models;
using BlogSite.Api.Results;
using Microsoft.EntityFrameworkCore;
namespace BlogSite.Api.Services;

public class LayoutTemplateService(BlogDbContext db)
{
    public async Task<Result<LayoutTemplate>> CreateAsync(
        CreateLayoutTemplateRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<LayoutTemplate>.Failure("template.name_required", "Template name is required.");
        }

        if (request.IsDefault)
        {
            var existingDefaults = await db.LayoutTemplates
                .Where(template => template.IsDefault)
                .ToListAsync(cancellationToken);

            foreach (var existingDefault in existingDefaults)
            {
                existingDefault.IsDefault = false;
            }
        }

        var template = new LayoutTemplate
        {
            Name = request.Name.Trim(),
            Description = request.Description,
            LayoutJson = TemplateJsonSerializer.SerializeLayout(request.Layout),
            IsDefault = request.IsDefault
        };

        db.LayoutTemplates.Add(template);
        await db.SaveChangesAsync(cancellationToken);

        return Result<LayoutTemplate>.Success(template);
    }

    public async Task<Result<LayoutTemplate>> UpdateAsync(
        int id,
        UpdateLayoutTemplateRequest request,
        CancellationToken cancellationToken)
    {
        var template = await db.LayoutTemplates.FindAsync([id], cancellationToken);
        if (template is null)
        {
            return Result<LayoutTemplate>.Failure("template.not_found", "Template was not found.");
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<LayoutTemplate>.Failure("template.name_required", "Template name is required.");
        }

        if (request.IsDefault && !template.IsDefault)
        {
            var existingDefaults = await db.LayoutTemplates
                .Where(existingTemplate => existingTemplate.IsDefault && existingTemplate.Id != id)
                .ToListAsync(cancellationToken);

            foreach (var existingDefault in existingDefaults)
            {
                existingDefault.IsDefault = false;
            }
        }

        template.Name = request.Name.Trim();
        template.Description = request.Description;
        template.LayoutJson = TemplateJsonSerializer.SerializeLayout(request.Layout);
        template.IsDefault = request.IsDefault;
        template.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
        return Result<LayoutTemplate>.Success(template);
    }

    public async Task<Result> DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var template = await db.LayoutTemplates.FindAsync([id], cancellationToken);
        if (template is null)
        {
            return Result.Failure("template.not_found", "Template was not found.");
        }

        db.LayoutTemplates.Remove(template);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
