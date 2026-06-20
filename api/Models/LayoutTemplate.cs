using System.Text.Json;

namespace BlogSite.Api.Models;

public class LayoutTemplate
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public JsonDocument LayoutJson { get; set; } = JsonDocument.Parse("{}");
    public bool IsDefault { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Category> Categories { get; set; } = new List<Category>();
    public ICollection<Post> Posts { get; set; } = new List<Post>();
}
