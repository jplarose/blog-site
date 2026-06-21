using BlogSite.Api.DTOs;
using BlogSite.Api.Domain;
using BlogSite.Api.Repositories;
using BlogSite.Api.Results;
using System.Text.RegularExpressions;

namespace BlogSite.Api.Services;

public class PostService(IPostRepository posts)
{
    public async Task<Result<PostDto>> CreateAsync(
        CreatePostRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<PostStatus>(request.Status, true, out var status))
        {
            return Result<PostDto>.Failure(
                "post.invalid_status",
                "Invalid status value.");
        }

        var post = await posts.CreateAsync(
            ToPostWrite(request, status),
            cancellationToken);

        return Result<PostDto>.Success(post);
    }

    public async Task<Result<PostDto>> UpdateAsync(
        int id,
        UpdatePostRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<PostStatus>(request.Status, true, out var status))
        {
            return Result<PostDto>.Failure(
                "post.invalid_status",
                "Invalid status value.");
        }

        var post = await posts.UpdateAsync(
            id,
            ToPostWrite(request, status),
            cancellationToken);

        return post is null
            ? Result<PostDto>.Failure("post.not_found", "Post was not found.")
            : Result<PostDto>.Success(post);
    }

    public async Task<Result> DeleteAsync(
        int id,
        CancellationToken cancellationToken)
    {
        var deleted = await posts.DeleteAsync(id, cancellationToken);
        return deleted
            ? Result.Success()
            : Result.Failure("post.not_found", "Post was not found.");
    }

    public async Task<Result<PostDto>> PublishAsync(
        int id,
        CancellationToken cancellationToken)
    {
        var post = await posts.PublishAsync(id, cancellationToken);
        return post is null
            ? Result<PostDto>.Failure("post.not_found", "Post was not found.")
            : Result<PostDto>.Success(post);
    }

    internal static IReadOnlyList<PostTagWrite> NormalizeTags(
        IEnumerable<string> requestedTags) =>
        requestedTags
            .Select(tag => tag.Trim())
            .Where(tag => !string.IsNullOrWhiteSpace(tag))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(tag => new PostTagWrite(tag, SlugifyTag(tag)))
            .GroupBy(tag => tag.Slug, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .ToList();

    private static PostWrite ToPostWrite(
        CreatePostRequest request,
        PostStatus status) =>
        new(
            request.Title.Trim(),
            request.Slug.Trim(),
            request.Content,
            request.Excerpt,
            request.FeaturedImageUrl,
            status.ToString(),
            request.ScheduledAt,
            request.CategoryId,
            request.TemplateId,
            request.TemplateContent,
            NormalizeTags(request.Tags ?? []));

    private static PostWrite ToPostWrite(
        UpdatePostRequest request,
        PostStatus status) =>
        new(
            request.Title.Trim(),
            request.Slug.Trim(),
            request.Content,
            request.Excerpt,
            request.FeaturedImageUrl,
            status.ToString(),
            request.ScheduledAt,
            request.CategoryId,
            request.TemplateId,
            request.TemplateContent,
            NormalizeTags(request.Tags ?? []));

    private static string SlugifyTag(string value)
    {
        var slug = Regex.Replace(
                value.Trim().ToLowerInvariant(),
                @"[^a-z0-9]+",
                "-")
            .Trim('-');

        return string.IsNullOrWhiteSpace(slug) ? "tag" : slug;
    }
}
