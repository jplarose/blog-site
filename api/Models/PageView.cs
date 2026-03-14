namespace BlogSite.Api.Models;

public class PageView
{
    public int Id { get; set; }
    public int? PostId { get; set; }
    public string Path { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? Referrer { get; set; }
    public DateTime ViewedAt { get; set; } = DateTime.UtcNow;

    public Post? Post { get; set; }
}
