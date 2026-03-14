namespace BlogSite.Api.Models;

public class PostTag
{
    public int PostId { get; set; }
    public int TagId { get; set; }

    public Post Post { get; set; } = null!;
    public Tag Tag { get; set; } = null!;
}
