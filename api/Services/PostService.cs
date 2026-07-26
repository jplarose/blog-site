using BlogSite.Api.DTOs;
using BlogSite.Api.Domain;
using BlogSite.Api.Repositories;
using BlogSite.Api.Results;
using System.Text.RegularExpressions;

namespace BlogSite.Api.Services;

public class PostService(IPostRepository posts, ILayoutTemplateRepository templates)
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

        var templateValidation = await ValidateTemplateAsync(
            request.TemplateId,
            cancellationToken);
        if (templateValidation is not null)
        {
            return templateValidation;
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

        var templateValidation = await ValidateTemplateAsync(
            request.TemplateId,
            cancellationToken);
        if (templateValidation is not null)
        {
            return templateValidation;
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

    /// <summary>
    /// Schedules a post to go live at a future time. There is no background
    /// scheduler in this system: a Scheduled post only becomes Published
    /// (and publicly visible) via an explicit call to
    /// <see cref="PublishAsync"/> after the scheduled time has passed.
    /// </summary>
    public async Task<Result<PostDto>> ScheduleAsync(
        int id,
        ScheduleRequest request,
        CancellationToken cancellationToken)
    {
        if (request.ScheduledAt is null)
        {
            return Result<PostDto>.Failure(
                "post.invalid_schedule",
                "ScheduledAt is required.");
        }

        if (request.ScheduledAt.Value <= DateTime.UtcNow)
        {
            return Result<PostDto>.Failure(
                "post.invalid_schedule",
                "ScheduledAt must be in the future.");
        }

        var scheduled = await posts.ScheduleAsync(
            id,
            request.ScheduledAt.Value,
            cancellationToken);
        if (scheduled is not null)
        {
            return Result<PostDto>.Success(scheduled);
        }

        var exists = await posts.ExistsAsync(id, cancellationToken);
        return exists
            ? Result<PostDto>.Failure(
                "post.invalid_transition",
                "Only draft or scheduled posts can be scheduled.")
            : Result<PostDto>.Failure("post.not_found", "Post was not found.");
    }

    /// <summary>
    /// Archives a post. Allowed from any state and idempotent: archiving an
    /// already-Archived post simply returns it unchanged.
    /// </summary>
    public async Task<Result<PostDto>> ArchiveAsync(
        int id,
        CancellationToken cancellationToken)
    {
        var post = await posts.ArchiveAsync(id, cancellationToken);
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

    private async Task<Result<PostDto>?> ValidateTemplateAsync(
        int? templateId,
        CancellationToken cancellationToken)
    {
        if (templateId is null || !await templates.ExistsAsync(templateId.Value, cancellationToken))
        {
            return Result<PostDto>.Failure(
                "post.template_invalid",
                "TemplateId must reference an existing catalog template.");
        }

        return null;
    }

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
