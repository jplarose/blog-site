using BlogSite.Api.Data;
using BlogSite.Api.DTOs;
using BlogSite.Api.Models;
using BlogSite.Api.Results;
using BlogSite.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlogSite.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController(
    BlogDbContext db,
    CategoryService categoryService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<CategoryDto>), StatusCodes.Status200OK)]
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
    [ProducesResponseType(typeof(CategoryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CategoryDto>> GetCategory(int id, CancellationToken cancellationToken)
    {
        var category = await db.Categories
            .Include(c => c.DefaultTemplate)
            .Include(c => c.Posts)
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        return category is null ? NotFound() : Ok(ToDto(category));
    }

    [HttpPost]
    [ProducesResponseType(typeof(CategoryDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CategoryDto>> CreateCategory(
        [FromBody] CreateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await categoryService.CreateAsync(request, cancellationToken);
        if (result.IsFailure)
        {
            return MapFailure<CategoryDto>(result);
        }

        return CreatedAtAction(nameof(GetCategory), new { id = result.Value!.Id }, ToDto(result.Value!));
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(CategoryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CategoryDto>> UpdateCategory(
        int id,
        [FromBody] UpdateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await categoryService.UpdateAsync(id, request, cancellationToken);
        if (result.IsFailure)
        {
            return MapFailure<CategoryDto>(result);
        }

        return Ok(ToDto(result.Value!));
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCategory(int id, CancellationToken cancellationToken)
    {
        var result = await categoryService.DeleteAsync(id, cancellationToken);
        if (result.IsFailure)
        {
            return MapFailure(result);
        }

        return NoContent();
    }

    private static CategoryDto ToDto(Category c) => new(
        c.Id, c.Name, c.Slug, c.Description,
        c.DefaultTemplateId, c.DefaultTemplate?.Name,
        c.Posts.Count, c.CreatedAt, c.UpdatedAt
    );

    private ActionResult<T> MapFailure<T>(Result result) =>
        result.Error?.Code switch
        {
            "category.not_found" => NotFound(result.Error.Message),
            "category.name_required" => BadRequest(result.Error.Message),
            "category.slug_required" => BadRequest(result.Error.Message),
            _ => BadRequest(result.Error?.Message ?? "The request could not be completed.")
        };

    private IActionResult MapFailure(Result result) =>
        result.Error?.Code switch
        {
            "category.not_found" => NotFound(result.Error.Message),
            _ => BadRequest(result.Error?.Message ?? "The request could not be completed.")
        };
}
