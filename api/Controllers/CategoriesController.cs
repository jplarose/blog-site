using BlogSite.Api.DTOs;
using BlogSite.Api.Repositories;
using BlogSite.Api.Results;
using BlogSite.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogSite.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CategoriesController(
    ICategoryRepository categories,
    CategoryService categoryService) : ControllerBase
{
    /// <summary>Gets all categories and their post counts.</summary>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IEnumerable<CategoryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<CategoryDto>>> GetCategories(
        CancellationToken cancellationToken) =>
        Ok(await categories.GetAllAsync(cancellationToken));

    /// <summary>Gets a category by identifier.</summary>
    /// <param name="id">Category identifier.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(CategoryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CategoryDto>> GetCategory(
        int id,
        CancellationToken cancellationToken)
    {
        var category = await categories.GetByIdAsync(id, cancellationToken);
        return category is null ? NotFound() : Ok(category);
    }

    /// <summary>Creates a category.</summary>
    /// <param name="request">Category values.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpPost]
    [ProducesResponseType(typeof(CategoryDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CategoryDto>> CreateCategory(
        [FromBody] CreateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await categoryService.CreateAsync(request, cancellationToken);
        return result.IsFailure
            ? MapFailure<CategoryDto>(result)
            : CreatedAtAction(
                nameof(GetCategory),
                new { id = result.Value!.Id },
                result.Value);
    }

    /// <summary>Updates a category.</summary>
    /// <param name="id">Category identifier.</param>
    /// <param name="request">Updated category values.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
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
        return result.IsFailure
            ? MapFailure<CategoryDto>(result)
            : Ok(result.Value);
    }

    /// <summary>Deletes a category.</summary>
    /// <param name="id">Category identifier.</param>
    /// <param name="cancellationToken">Cancels the database operation.</param>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCategory(
        int id,
        CancellationToken cancellationToken)
    {
        var result = await categoryService.DeleteAsync(id, cancellationToken);
        return result.IsFailure ? MapFailure(result) : NoContent();
    }

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
