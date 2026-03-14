namespace BlogSite.Api.Models;

public enum PostStatus
{
    Draft,
    Scheduled,
    Published,
    Archived
}

public class Post
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? Excerpt { get; set; }
    public string? FeaturedImageUrl { get; set; }
    public PostStatus Status { get; set; } = PostStatus.Draft;
    public DateTime? PublishedAt { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public int? CategoryId { get; set; }
    public int? TemplateId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Category? Category { get; set; }
    public LayoutTemplate? Template { get; set; }
    public ICollection<PostTag> PostTags { get; set; } = new List<PostTag>();
    public ICollection<PageView> PageViews { get; set; } = new List<PageView>();
}
