using BlogSite.Api.Data;
using BlogSite.Api.DTOs;
using BlogSite.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlogSite.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TagsController(BlogDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<TagDto>>> GetTags()
    {
        var tags = await db.Tags
            .Include(t => t.PostTags)
            .OrderBy(t => t.Name)
            .ToListAsync();

        return Ok(tags.Select(ToDto));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<TagDto>> GetTag(int id)
    {
        var tag = await db.Tags
            .Include(t => t.PostTags)
            .FirstOrDefaultAsync(t => t.Id == id);

        return tag is null ? NotFound() : Ok(ToDto(tag));
    }

    [HttpPost]
    public async Task<ActionResult<TagDto>> CreateTag([FromBody] CreateTagRequest request)
    {
        var tag = new Tag { Name = request.Name, Slug = request.Slug };
        db.Tags.Add(tag);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetTag), new { id = tag.Id }, ToDto(tag));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<TagDto>> UpdateTag(int id, [FromBody] UpdateTagRequest request)
    {
        var tag = await db.Tags
            .Include(t => t.PostTags)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (tag is null) return NotFound();

        tag.Name = request.Name;
        tag.Slug = request.Slug;
        await db.SaveChangesAsync();

        return Ok(ToDto(tag));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteTag(int id)
    {
        var tag = await db.Tags.FindAsync(id);
        if (tag is null) return NotFound();
        db.Tags.Remove(tag);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static TagDto ToDto(Tag t) => new(
        t.Id, t.Name, t.Slug, t.PostTags.Count, t.CreatedAt
    );
}
