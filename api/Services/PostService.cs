using BlogSite.Api.Data;
using BlogSite.Api.DTOs;
using BlogSite.Api.Models;
using BlogSite.Api.Results;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace BlogSite.Api.Services;

public class PostService(BlogDbContext db)
{
    public async Task<Result<(Post Post, PostTemplateContentDto? TemplateContent)>> CreateAsync(
        CreatePostRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<PostStatus>(request.Status, true, out var status))
        {
            return Result<(Post, PostTemplateContentDto?)>.Failure("post.invalid_status", "Invalid status value.");
        }

        var post = new Post
        {
            Title = request.Title.Trim(),
            Slug = request.Slug.Trim(),
            Content = request.Content,
            Excerpt = request.Excerpt,
            FeaturedImageUrl = request.FeaturedImageUrl,
            Status = status,
            ScheduledAt = request.ScheduledAt,
            CategoryId = request.CategoryId,
            TemplateId = request.TemplateId,
            TemplateContentJson = TemplateJsonSerializer.SerializeTemplateContent(request.TemplateContent),
            PublishedAt = status == PostStatus.Published ? DateTime.UtcNow : null
        };

        db.Posts.Add(post);
        await db.SaveChangesAsync(cancellationToken);

        var tags = await ResolveTagsAsync(request.Tags ?? [], cancellationToken);
        foreach (var tag in tags)
        {
            db.PostTags.Add(new PostTag { PostId = post.Id, TagId = tag.Id });
        }

        await db.SaveChangesAsync(cancellationToken);

        await LoadPostGraphAsync(post, cancellationToken);
        return Result<(Post, PostTemplateContentDto?)>.Success((post, request.TemplateContent));
    }

    public async Task<Result<(Post Post, PostTemplateContentDto? TemplateContent)>> UpdateAsync(
        int id,
        UpdatePostRequest request,
        CancellationToken cancellationToken)
    {
        var post = await db.Posts
            .Include(p => p.PostTags)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (post is null)
        {
            return Result<(Post, PostTemplateContentDto?)>.Failure("post.not_found", "Post was not found.");
        }

        if (!Enum.TryParse<PostStatus>(request.Status, true, out var status))
        {
            return Result<(Post, PostTemplateContentDto?)>.Failure("post.invalid_status", "Invalid status value.");
        }

        post.Title = request.Title.Trim();
        post.Slug = request.Slug.Trim();
        post.Content = request.Content;
        post.Excerpt = request.Excerpt;
        post.FeaturedImageUrl = request.FeaturedImageUrl;
        post.ScheduledAt = request.ScheduledAt;
        post.CategoryId = request.CategoryId;
        post.TemplateId = request.TemplateId;
        post.TemplateContentJson = TemplateJsonSerializer.SerializeTemplateContent(request.TemplateContent);
        post.UpdatedAt = DateTime.UtcNow;

        if (status == PostStatus.Published && post.Status != PostStatus.Published)
        {
            post.PublishedAt = DateTime.UtcNow;
        }

        post.Status = status;

        db.PostTags.RemoveRange(post.PostTags);
        var tags = await ResolveTagsAsync(request.Tags ?? [], cancellationToken);
        foreach (var tag in tags)
        {
            db.PostTags.Add(new PostTag { PostId = post.Id, TagId = tag.Id });
        }

        await db.SaveChangesAsync(cancellationToken);

        await LoadPostGraphAsync(post, cancellationToken);
        return Result<(Post, PostTemplateContentDto?)>.Success((post, request.TemplateContent));
    }

    public async Task<Result> DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var post = await db.Posts.FindAsync([id], cancellationToken);
        if (post is null)
        {
            return Result.Failure("post.not_found", "Post was not found.");
        }

        db.Posts.Remove(post);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    public async Task<Result<Post>> PublishAsync(int id, CancellationToken cancellationToken)
    {
        var post = await db.Posts
            .Include(p => p.Category)
            .Include(p => p.Template)
            .Include(p => p.PostTags)
            .ThenInclude(pt => pt.Tag)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (post is null)
        {
            return Result<Post>.Failure("post.not_found", "Post was not found.");
        }

        post.Status = PostStatus.Published;
        post.PublishedAt = DateTime.UtcNow;
        post.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
        return Result<Post>.Success(post);
    }

    private async Task LoadPostGraphAsync(Post post, CancellationToken cancellationToken)
    {
        await db.Entry(post).Reference(p => p.Category).LoadAsync(cancellationToken);
        await db.Entry(post).Reference(p => p.Template).LoadAsync(cancellationToken);
        await db.Entry(post).Collection(p => p.PostTags).Query()
            .Include(pt => pt.Tag)
            .LoadAsync(cancellationToken);
    }

    private async Task<List<Tag>> ResolveTagsAsync(
        IEnumerable<string> requestedTags,
        CancellationToken cancellationToken)
    {
        var normalizedTags = requestedTags
            .Select(tag => tag.Trim())
            .Where(tag => !string.IsNullOrWhiteSpace(tag))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (normalizedTags.Count == 0)
        {
            return [];
        }

        var normalizedSlugs = normalizedTags
            .Select(SlugifyTag)
            .ToList();

        var existingTags = await db.Tags
            .Where(tag => normalizedSlugs.Contains(tag.Slug))
            .ToListAsync(cancellationToken);

        var tagsBySlug = existingTags.ToDictionary(tag => tag.Slug, StringComparer.OrdinalIgnoreCase);

        foreach (var tagName in normalizedTags)
        {
            var slug = SlugifyTag(tagName);
            if (tagsBySlug.ContainsKey(slug))
            {
                continue;
            }

            var tag = new Tag
            {
                Name = tagName,
                Slug = slug
            };

            db.Tags.Add(tag);
            tagsBySlug[slug] = tag;
        }

        if (db.ChangeTracker.HasChanges())
        {
            await db.SaveChangesAsync(cancellationToken);
        }

        return normalizedSlugs
            .Select(slug => tagsBySlug[slug])
            .ToList();
    }

    private static string SlugifyTag(string value)
    {
        var slug = Regex.Replace(value.Trim().ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
        return string.IsNullOrWhiteSpace(slug) ? "tag" : slug;
    }
}
