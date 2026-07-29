using BlogSite.Api.DTOs;
using BlogSite.Api.Repositories;
using BlogSite.Api.Results;
using BlogSite.Api.Validation;
using Npgsql;

namespace BlogSite.Api.Services;

public class TagService(ITagRepository tags)
{
    private const string UniqueViolationSqlState = "23505";

    public async Task<Result<TagDto>> CreateAsync(
        CreateTagRequest request,
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
            var tag = await tags.CreateAsync(name, slug, cancellationToken);
            return Result<TagDto>.Success(tag);
        }
        catch (PostgresException ex) when (ex.SqlState == UniqueViolationSqlState)
        {
            // Safety net for a race between the pre-check above and this
            // insert: the DB's unique index on slug is the source of truth.
            return DuplicateSlugFailure();
        }
    }

    public async Task<Result<TagDto>> UpdateAsync(
        int id,
        UpdateTagRequest request,
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

        TagDto? tag;
        try
        {
            tag = await tags.UpdateAsync(id, name, slug, cancellationToken);
        }
        catch (PostgresException ex) when (ex.SqlState == UniqueViolationSqlState)
        {
            return DuplicateSlugFailure();
        }

        return tag is null
            ? Result<TagDto>.Failure("tag.not_found", "Tag was not found.")
            : Result<TagDto>.Success(tag);
    }

    public async Task<Result> DeleteAsync(
        int id,
        CancellationToken cancellationToken)
    {
        // Admin-only path: count posts of every status so a tag attached
        // to drafts/scheduled posts still refuses deletion.
        var existing = await tags.GetByIdAsync(
            id,
            publishedOnly: false,
            cancellationToken);
        if (existing is null)
        {
            return Result.Failure("tag.not_found", "Tag was not found.");
        }

        if (existing.PostCount > 0)
        {
            // post_tags has ON DELETE CASCADE, so the DB would silently
            // detach this tag from every post on delete. Refused here
            // (symmetric with category delete-referenced) so removing a
            // tag is always an explicit, visible admin decision.
            return Result.Failure(
                "tag.referenced",
                "Tag cannot be deleted because it is still attached to posts.");
        }

        var deleted = await tags.DeleteAsync(id, cancellationToken);
        return deleted
            ? Result.Success()
            : Result.Failure("tag.not_found", "Tag was not found.");
    }

    private async Task<Result<TagDto>?> ValidateAsync(
        string name,
        string slug,
        int? excludeId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result<TagDto>.Failure("tag.name_required", "Tag name is required.");
        }

        if (string.IsNullOrWhiteSpace(slug))
        {
            return Result<TagDto>.Failure("tag.slug_required", "Tag slug is required.");
        }

        var trimmedSlug = slug.Trim();
        if (!SlugValidator.IsUrlSafe(trimmedSlug))
        {
            return Result<TagDto>.Failure(
                "tag.slug_invalid",
                "Tag slug must contain only lowercase letters, digits, and hyphens.");
        }

        var trimmedName = name.Trim();
        if (await tags.NameExistsAsync(trimmedName, excludeId, cancellationToken))
        {
            return Result<TagDto>.Failure(
                "tag.duplicate_name",
                "A tag with this name already exists.");
        }

        if (await tags.SlugExistsAsync(trimmedSlug, excludeId, cancellationToken))
        {
            return DuplicateSlugFailure();
        }

        return null;
    }

    private static Result<TagDto> DuplicateSlugFailure() =>
        Result<TagDto>.Failure(
            "tag.duplicate_slug",
            "A tag with this slug already exists.");
}
