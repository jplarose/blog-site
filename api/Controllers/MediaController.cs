using BlogSite.Api.DTOs;
using BlogSite.Api.Results;
using BlogSite.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogSite.Api.Controllers;

[ApiController]
[Route("api/media")]
[Authorize]
public sealed class MediaController(MediaService mediaService) : ControllerBase
{
    /// <summary>Uploads an image and returns its public media URL.</summary>
    /// <param name="file">Multipart image file.</param>
    /// <param name="cancellationToken">Cancels the upload operation.</param>
    [HttpPost("images")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MediaService.MaximumRequestSizeBytes)]
    [ProducesResponseType(typeof(MediaUploadDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(MediaErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(MediaErrorResponse), StatusCodes.Status413PayloadTooLarge)]
    [ProducesResponseType(typeof(MediaErrorResponse), StatusCodes.Status415UnsupportedMediaType)]
    [ProducesResponseType(typeof(MediaErrorResponse), StatusCodes.Status502BadGateway)]
    public async Task<ActionResult<MediaUploadDto>> UploadImage(
        [FromForm] IFormFile? file,
        CancellationToken cancellationToken)
    {
        if (file is null)
        {
            return Error(
                StatusCodes.Status400BadRequest,
                "media.file_required",
                "An image file is required.");
        }

        await using var content = file.OpenReadStream();
        var result = await mediaService.UploadImageAsync(
            content,
            file.Length,
            file.ContentType,
            cancellationToken);

        if (result.IsSuccess)
        {
            return StatusCode(StatusCodes.Status201Created, result.Value);
        }

        return result.Error!.Code switch
        {
            "media.file_required" => Error(
                StatusCodes.Status400BadRequest,
                result.Error),
            "media.file_too_large" => Error(
                StatusCodes.Status413PayloadTooLarge,
                result.Error),
            "media.unsupported_type" => Error(
                StatusCodes.Status415UnsupportedMediaType,
                result.Error),
            _ => Error(
                StatusCodes.Status502BadGateway,
                result.Error)
        };
    }

    private ObjectResult Error(int statusCode, ResultError error) =>
        Error(statusCode, error.Code, error.Message);

    private ObjectResult Error(
        int statusCode,
        string code,
        string message) =>
        StatusCode(statusCode, new MediaErrorResponse(code, message));
}

public sealed record MediaErrorResponse(string Code, string Message);
