using BlogSite.Api.DTOs;
using BlogSite.Api.Repositories;
using BlogSite.Api.Results;

namespace BlogSite.Api.Services;

public class TagService(ITagRepository tags)
{
    public async Task<Result<TagDto>> CreateAsync(
        CreateTagRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<TagDto>.Failure("tag.name_required", "Tag name is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Slug))
        {
            return Result<TagDto>.Failure("tag.slug_required", "Tag slug is required.");
        }

        var tag = await tags.CreateAsync(
            request.Name.Trim(),
            request.Slug.Trim(),
            cancellationToken);

        return Result<TagDto>.Success(tag);
    }

    public async Task<Result<TagDto>> UpdateAsync(
        int id,
        UpdateTagRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<TagDto>.Failure("tag.name_required", "Tag name is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Slug))
        {
            return Result<TagDto>.Failure("tag.slug_required", "Tag slug is required.");
        }

        var tag = await tags.UpdateAsync(
            id,
            request.Name.Trim(),
            request.Slug.Trim(),
            cancellationToken);

        return tag is null
            ? Result<TagDto>.Failure("tag.not_found", "Tag was not found.")
            : Result<TagDto>.Success(tag);
    }

    public async Task<Result> DeleteAsync(
        int id,
        CancellationToken cancellationToken)
    {
        var deleted = await tags.DeleteAsync(id, cancellationToken);
        return deleted
            ? Result.Success()
            : Result.Failure("tag.not_found", "Tag was not found.");
    }
}
