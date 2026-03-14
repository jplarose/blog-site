using BlogSite.Api.Data;
using BlogSite.Api.DTOs;
using BlogSite.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlogSite.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController(BlogDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<CategoryDto>>> GetCategories()
    {
        var categories = await db.Categories
            .Include(c => c.DefaultTemplate)
            .Include(c => c.Posts)
            .OrderBy(c => c.Name)
            .ToListAsync();

        return Ok(categories.Select(ToDto));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CategoryDto>> GetCategory(int id)
    {
        var category = await db.Categories
            .Include(c => c.DefaultTemplate)
            .Include(c => c.Posts)
            .FirstOrDefaultAsync(c => c.Id == id);

        return category is null ? NotFound() : Ok(ToDto(category));
    }

    [HttpPost]
    public async Task<ActionResult<CategoryDto>> CreateCategory([FromBody] CreateCategoryRequest request)
    {
        var category = new Category
        {
            Name = request.Name,
            Slug = request.Slug,
            Description = request.Description,
            DefaultTemplateId = request.DefaultTemplateId
        };

        db.Categories.Add(category);
        await db.SaveChangesAsync();

        await db.Entry(category).Reference(c => c.DefaultTemplate).LoadAsync();

        return CreatedAtAction(nameof(GetCategory), new { id = category.Id }, ToDto(category));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<CategoryDto>> UpdateCategory(int id, [FromBody] UpdateCategoryRequest request)
    {
        var category = await db.Categories
            .Include(c => c.DefaultTemplate)
            .Include(c => c.Posts)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category is null) return NotFound();

        category.Name = request.Name;
        category.Slug = request.Slug;
        category.Description = request.Description;
        category.DefaultTemplateId = request.DefaultTemplateId;
        category.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        await db.Entry(category).Reference(c => c.DefaultTemplate).LoadAsync();

        return Ok(ToDto(category));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var category = await db.Categories.FindAsync(id);
        if (category is null) return NotFound();
        db.Categories.Remove(category);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static CategoryDto ToDto(Category c) => new(
        c.Id, c.Name, c.Slug, c.Description,
        c.DefaultTemplateId, c.DefaultTemplate?.Name,
        c.Posts.Count, c.CreatedAt, c.UpdatedAt
    );
}
