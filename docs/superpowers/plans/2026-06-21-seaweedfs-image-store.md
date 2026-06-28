# SeaweedFS Image Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add validated image uploads to the .NET API through a replaceable storage interface backed by SeaweedFS Filer HTTP, then replace admin post image URL inputs with file-upload controls.

**Architecture:** The API exposes `POST /api/media/images`; a focused media service validates the upload and generates a provider-neutral object path, while `IImageStore` delegates persistence to `SeaweedFilerImageStore`. The admin browser uploads through a same-origin Next.js route, stores the returned public URL in existing post state, and continues saving posts as JSON.

**Tech Stack:** .NET 10, ASP.NET Core controllers, typed `HttpClient`, xUnit, Next.js 16 Route Handlers, React 19, TypeScript, Vitest, Testing Library

---

## File Map

### API files

- Create `api/Options/SeaweedFilerOptions.cs` for private/public URL and path-prefix configuration.
- Create `api/Storage/IImageStore.cs` for the provider-neutral upload contract.
- Create `api/Storage/SeaweedFilerImageStore.cs` for Filer multipart upload, bounded retries, and public URL construction.
- Create `api/Extensions/AddImageStorageExtension.cs` for options validation and typed `HttpClient` registration.
- Create `api/DTOs/MediaDtos.cs` for the successful upload response.
- Create `api/Services/MediaService.cs` for MIME/size validation and generated object paths.
- Create `api/Controllers/MediaController.cs` for multipart binding and HTTP result mapping.
- Modify `api/Program.cs` to register image storage.
- Modify `api/appsettings.Development.json` to document local SeaweedFS settings.
- Create `api.Tests/Extensions/AddImageStorageExtensionTests.cs`.
- Create `api.Tests/Storage/SeaweedFilerImageStoreTests.cs`.
- Create `api.Tests/Services/MediaServiceTests.cs`.
- Create `api.Tests/Controllers/MediaControllerTests.cs`.

### Admin files

- Modify `ui-admin/lib/api-proxy.ts` so multipart requests are forwarded as binary data rather than decoded text.
- Create `ui-admin/app/api/media/images/route.ts` as the same-origin upload route.
- Modify `ui-admin/lib/api.ts` to expose `mediaApi.uploadImage(file)`.
- Create `ui-admin/components/media/ImageUploadControl.tsx` for selection, upload state, preview, replacement, and local errors.
- Modify `ui-admin/components/post-editor/PostEditorForm.tsx` to use uploads for featured images, template images, and gallery items.
- Create `ui-admin/__tests__/image-upload-control.test.tsx`.
- Create `ui-admin/__tests__/post-editor-image-upload.test.tsx`.
- Create `ui-admin/__tests__/api-proxy.test.ts`.

## Task 1: Register and validate SeaweedFS configuration

**Files:**
- Create: `api/Options/SeaweedFilerOptions.cs`
- Create: `api/Extensions/AddImageStorageExtension.cs`
- Modify: `api/Program.cs`
- Modify: `api/appsettings.Development.json`
- Test: `api.Tests/Extensions/AddImageStorageExtensionTests.cs`

- [ ] **Step 1: Write failing registration and validation tests**

Create `api.Tests/Extensions/AddImageStorageExtensionTests.cs`:

```csharp
using BlogSite.Api.Extensions;
using BlogSite.Api.Options;
using BlogSite.Api.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace BlogSite.Api.Tests.Extensions;

public class AddImageStorageExtensionTests
{
    [Fact]
    public void AddImageStorage_CompleteConfiguration_RegistersStoreAndOptions()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["SeaweedFiler:PrivateBaseUrl"] = "http://seaweed-filer:8888",
            ["SeaweedFiler:PublicBaseUrl"] = "https://media.example.test",
            ["SeaweedFiler:PathPrefix"] = "blog/images"
        });
        var services = new ServiceCollection();
        services.AddLogging();

        services.AddImageStorage(configuration);

        using var provider = services.BuildServiceProvider();
        var options = provider.GetRequiredService<IOptions<SeaweedFilerOptions>>().Value;
        var store = provider.GetRequiredService<IImageStore>();

        Assert.Equal("http://seaweed-filer:8888", options.PrivateBaseUrl);
        Assert.Equal("https://media.example.test", options.PublicBaseUrl);
        Assert.Equal("blog/images", options.PathPrefix);
        Assert.IsType<SeaweedFilerImageStore>(store);
    }

    [Fact]
    public void AddImageStorage_MissingPublicBaseUrl_FailsValidation()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["SeaweedFiler:PrivateBaseUrl"] = "http://seaweed-filer:8888"
        });
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddImageStorage(configuration);

        using var provider = services.BuildServiceProvider();

        Assert.Throws<OptionsValidationException>(
            () => provider.GetRequiredService<IOptions<SeaweedFilerOptions>>().Value);
    }

    [Fact]
    public void AddImageStorage_InvalidPathPrefix_FailsValidation()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["SeaweedFiler:PrivateBaseUrl"] = "http://seaweed-filer:8888",
            ["SeaweedFiler:PublicBaseUrl"] = "https://media.example.test",
            ["SeaweedFiler:PathPrefix"] = "../images"
        });
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddImageStorage(configuration);

        using var provider = services.BuildServiceProvider();

        Assert.Throws<OptionsValidationException>(
            () => provider.GetRequiredService<IOptions<SeaweedFilerOptions>>().Value);
    }

    private static IConfiguration BuildConfiguration(
        Dictionary<string, string?> values) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();
}
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
dotnet test api.Tests/BlogSite.Api.Tests.csproj \
  --filter FullyQualifiedName~AddImageStorageExtensionTests
```

Expected: compilation fails because the options, extension, and store types do not exist.

- [ ] **Step 3: Add the options and registration extension**

Create `api/Options/SeaweedFilerOptions.cs`:

```csharp
namespace BlogSite.Api.Options;

public sealed class SeaweedFilerOptions
{
    public const string SectionName = "SeaweedFiler";

    public string PrivateBaseUrl { get; init; } = "";
    public string PublicBaseUrl { get; init; } = "";
    public string PathPrefix { get; init; } = "images";
}
```

Create the initial contract in `api/Storage/IImageStore.cs` so registration compiles:

```csharp
using BlogSite.Api.Results;

namespace BlogSite.Api.Storage;

public sealed record ImageStoreUpload(
    Stream Content,
    string ObjectPath,
    string ContentType);

public sealed record StoredImage(string Url);

public interface IImageStore
{
    Task<Result<StoredImage>> UploadAsync(
        ImageStoreUpload upload,
        CancellationToken cancellationToken);
}
```

Create `api/Extensions/AddImageStorageExtension.cs`:

```csharp
using System.Text.RegularExpressions;
using BlogSite.Api.Options;
using BlogSite.Api.Storage;

namespace BlogSite.Api.Extensions;

public static partial class AddImageStorageExtension
{
    public static IServiceCollection AddImageStorage(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services
            .AddOptions<SeaweedFilerOptions>()
            .Bind(configuration.GetSection(SeaweedFilerOptions.SectionName))
            .Validate(
                options => IsAbsoluteHttpUrl(options.PrivateBaseUrl),
                "SeaweedFiler:PrivateBaseUrl must be an absolute HTTP or HTTPS URL.")
            .Validate(
                options => IsAbsoluteHttpUrl(options.PublicBaseUrl),
                "SeaweedFiler:PublicBaseUrl must be an absolute HTTP or HTTPS URL.")
            .Validate(
                options => PathPrefixPattern().IsMatch(options.PathPrefix),
                "SeaweedFiler:PathPrefix may contain letters, numbers, hyphens, underscores, and single slashes.")
            .ValidateOnStart();

        services.AddHttpClient<IImageStore, SeaweedFilerImageStore>();
        return services;
    }

    private static bool IsAbsoluteHttpUrl(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    [GeneratedRegex(@"^[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*$")]
    private static partial Regex PathPrefixPattern();
}
```

Create a compile-only shell in `api/Storage/SeaweedFilerImageStore.cs`; Task 2 replaces its body:

```csharp
using BlogSite.Api.Options;
using BlogSite.Api.Results;
using Microsoft.Extensions.Options;

namespace BlogSite.Api.Storage;

public sealed class SeaweedFilerImageStore(
    HttpClient httpClient,
    IOptions<SeaweedFilerOptions> options,
    ILogger<SeaweedFilerImageStore> logger) : IImageStore
{
    public Task<Result<StoredImage>> UploadAsync(
        ImageStoreUpload upload,
        CancellationToken cancellationToken) =>
        throw new NotImplementedException();
}
```

In `api/Program.cs`, add after `AddPostgres`:

```csharp
builder.Services.AddImageStorage(builder.Configuration);
```

Add to `api/appsettings.Development.json`:

```json
"SeaweedFiler": {
  "PrivateBaseUrl": "http://localhost:8888",
  "PublicBaseUrl": "http://localhost:8888",
  "PathPrefix": "images"
}
```

Keep valid JSON by adding the required comma after the preceding property.

- [ ] **Step 4: Run tests and verify registration passes**

Run:

```bash
dotnet test api.Tests/BlogSite.Api.Tests.csproj \
  --filter FullyQualifiedName~AddImageStorageExtensionTests
```

Expected: all three tests pass.

- [ ] **Step 5: Commit the configuration boundary**

```bash
git add api/Options/SeaweedFilerOptions.cs \
  api/Storage/IImageStore.cs \
  api/Storage/SeaweedFilerImageStore.cs \
  api/Extensions/AddImageStorageExtension.cs \
  api/Program.cs \
  api/appsettings.Development.json \
  api.Tests/Extensions/AddImageStorageExtensionTests.cs
git commit -m "feat(#5): register SeaweedFS image storage"
```

## Task 2: Implement the SeaweedFS Filer adapter

**Files:**
- Modify: `api/Storage/SeaweedFilerImageStore.cs`
- Test: `api.Tests/Storage/SeaweedFilerImageStoreTests.cs`

- [ ] **Step 1: Write failing adapter tests**

Create `api.Tests/Storage/SeaweedFilerImageStoreTests.cs` with a recording handler:

```csharp
using System.Net;
using BlogSite.Api.Options;
using BlogSite.Api.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace BlogSite.Api.Tests.Storage;

public class SeaweedFilerImageStoreTests
{
    [Fact]
    public async Task UploadAsync_Success_SendsMultipartAndReturnsPublicUrl()
    {
        var handler = new RecordingHandler(HttpStatusCode.Created);
        var store = CreateStore(handler);
        await using var content = new MemoryStream([1, 2, 3]);

        var result = await store.UploadAsync(
            new ImageStoreUpload(
                content,
                "images/2026/06/image-id.webp",
                "image/webp"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(
            "https://media.example.test/images/2026/06/image-id.webp",
            result.Value?.Url);
        Assert.Equal(
            "http://seaweed-filer:8888/images/2026/06/image-id.webp",
            handler.RequestUri?.ToString());
        Assert.Equal("multipart/form-data", handler.ContentType?.MediaType);
        Assert.Contains("image/webp", handler.RequestBody);
    }

    [Fact]
    public async Task UploadAsync_TransientFailure_RetriesThenSucceeds()
    {
        var handler = new SequenceHandler(
            HttpStatusCode.ServiceUnavailable,
            HttpStatusCode.Created);
        var store = CreateStore(handler);
        await using var content = new MemoryStream([1, 2, 3]);

        var result = await store.UploadAsync(
            new ImageStoreUpload(content, "images/2026/06/id.jpg", "image/jpeg"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, handler.CallCount);
    }

    [Fact]
    public async Task UploadAsync_PermanentFailure_ReturnsStorageFailure()
    {
        var handler = new RecordingHandler(HttpStatusCode.BadRequest);
        var store = CreateStore(handler);
        await using var content = new MemoryStream([1, 2, 3]);

        var result = await store.UploadAsync(
            new ImageStoreUpload(content, "images/2026/06/id.jpg", "image/jpeg"),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("media.storage_failed", result.Error?.Code);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task UploadAsync_Cancellation_Propagates()
    {
        var handler = new CancellationHandler();
        var store = CreateStore(handler);
        await using var content = new MemoryStream([1, 2, 3]);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => store.UploadAsync(
                new ImageStoreUpload(content, "images/2026/06/id.jpg", "image/jpeg"),
                cancellation.Token));
    }

    private static SeaweedFilerImageStore CreateStore(HttpMessageHandler handler) =>
        new(
            new HttpClient(handler),
            Options.Create(new SeaweedFilerOptions
            {
                PrivateBaseUrl = "http://seaweed-filer:8888/",
                PublicBaseUrl = "https://media.example.test/",
                PathPrefix = "images"
            }),
            NullLogger<SeaweedFilerImageStore>.Instance);

    private sealed class RecordingHandler(HttpStatusCode statusCode) : HttpMessageHandler
    {
        public int CallCount { get; private set; }
        public Uri? RequestUri { get; private set; }
        public System.Net.Http.Headers.MediaTypeHeaderValue? ContentType { get; private set; }
        public string RequestBody { get; private set; } = "";

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            CallCount++;
            RequestUri = request.RequestUri;
            ContentType = request.Content?.Headers.ContentType;
            RequestBody = request.Content is null
                ? ""
                : await request.Content.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(statusCode);
        }
    }

    private sealed class SequenceHandler(params HttpStatusCode[] statuses) : HttpMessageHandler
    {
        public int CallCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            var status = statuses[Math.Min(CallCount, statuses.Length - 1)];
            CallCount++;
            return Task.FromResult(new HttpResponseMessage(status));
        }
    }

    private sealed class CancellationHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) =>
            Task.FromCanceled<HttpResponseMessage>(cancellationToken);
    }
}
```

- [ ] **Step 2: Run the adapter tests and verify they fail**

Run:

```bash
dotnet test api.Tests/BlogSite.Api.Tests.csproj \
  --filter FullyQualifiedName~SeaweedFilerImageStoreTests
```

Expected: tests fail because `UploadAsync` throws `NotImplementedException`.

- [ ] **Step 3: Implement multipart upload, bounded buffering, and retries**

Replace `SeaweedFilerImageStore.UploadAsync` with:

```csharp
private const int MaximumAttempts = 3;

public async Task<Result<StoredImage>> UploadAsync(
    ImageStoreUpload upload,
    CancellationToken cancellationToken)
{
    byte[] bytes;
    using (var buffer = new MemoryStream())
    {
        await upload.Content.CopyToAsync(buffer, cancellationToken);
        bytes = buffer.ToArray();
    }

    var privateUrl = BuildUrl(options.Value.PrivateBaseUrl, upload.ObjectPath);

    for (var attempt = 1; attempt <= MaximumAttempts; attempt++)
    {
        using var multipart = new MultipartFormDataContent();
        using var fileContent = new ByteArrayContent(bytes);
        fileContent.Headers.ContentType =
            new System.Net.Http.Headers.MediaTypeHeaderValue(upload.ContentType);
        multipart.Add(
            fileContent,
            "file",
            Path.GetFileName(upload.ObjectPath));

        try
        {
            using var response = await httpClient.PostAsync(
                privateUrl,
                multipart,
                cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                return Result<StoredImage>.Success(
                    new StoredImage(
                        BuildUrl(options.Value.PublicBaseUrl, upload.ObjectPath)));
            }

            if (!IsTransient(response.StatusCode) || attempt == MaximumAttempts)
            {
                logger.LogWarning(
                    "SeaweedFS upload failed for {ObjectPath} with status {StatusCode}.",
                    upload.ObjectPath,
                    response.StatusCode);

                return StorageFailure();
            }
        }
        catch (HttpRequestException exception) when (attempt < MaximumAttempts)
        {
            logger.LogWarning(
                exception,
                "Transient SeaweedFS upload failure for {ObjectPath} on attempt {Attempt}.",
                upload.ObjectPath,
                attempt);
        }
        catch (HttpRequestException exception)
        {
            logger.LogError(
                exception,
                "SeaweedFS upload failed for {ObjectPath}.",
                upload.ObjectPath);
            return StorageFailure();
        }
    }

    return StorageFailure();
}

private static bool IsTransient(HttpStatusCode statusCode) =>
    statusCode is HttpStatusCode.RequestTimeout
        or HttpStatusCode.TooManyRequests
    || (int)statusCode >= 500;

private static string BuildUrl(string baseUrl, string objectPath) =>
    $"{baseUrl.TrimEnd('/')}/{objectPath.TrimStart('/')}";

private static Result<StoredImage> StorageFailure() =>
    Result<StoredImage>.Failure(
        "media.storage_failed",
        "The image could not be stored.");
```

Add:

```csharp
using System.Net;
```

Do not catch `OperationCanceledException`; request cancellation must propagate.

- [ ] **Step 4: Run adapter tests and verify they pass**

Run:

```bash
dotnet test api.Tests/BlogSite.Api.Tests.csproj \
  --filter FullyQualifiedName~SeaweedFilerImageStoreTests
```

Expected: all adapter tests pass.

- [ ] **Step 5: Commit the adapter**

```bash
git add api/Storage/SeaweedFilerImageStore.cs \
  api.Tests/Storage/SeaweedFilerImageStoreTests.cs
git commit -m "feat(#5): upload images through SeaweedFS Filer"
```

## Task 3: Add media validation and generated object paths

**Files:**
- Create: `api/DTOs/MediaDtos.cs`
- Create: `api/Services/MediaService.cs`
- Test: `api.Tests/Services/MediaServiceTests.cs`

- [ ] **Step 1: Write failing service tests**

Create `api.Tests/Services/MediaServiceTests.cs`:

```csharp
using BlogSite.Api.Services;
using BlogSite.Api.Storage;

namespace BlogSite.Api.Tests.Services;

public class MediaServiceTests
{
    [Theory]
    [InlineData("image/jpeg", ".jpg")]
    [InlineData("image/png", ".png")]
    [InlineData("image/webp", ".webp")]
    [InlineData("image/gif", ".gif")]
    public async Task UploadImageAsync_AllowedType_GeneratesExpectedPath(
        string contentType,
        string extension)
    {
        var store = new FakeImageStore();
        var clock = new DateTimeOffset(2026, 6, 21, 12, 0, 0, TimeSpan.Zero);
        var service = new MediaService(
            store,
            () => clock,
            () => Guid.Parse("7bf42d61-6abc-49ec-a01d-bf1ae57fcfea"),
            "images");
        await using var content = new MemoryStream([1, 2, 3]);

        var result = await service.UploadImageAsync(
            content,
            content.Length,
            contentType,
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(
            $"images/2026/06/7bf42d61-6abc-49ec-a01d-bf1ae57fcfea{extension}",
            store.Upload?.ObjectPath);
    }

    [Fact]
    public async Task UploadImageAsync_EmptyFile_ReturnsRequiredFailure()
    {
        var store = new FakeImageStore();
        var service = CreateService(store);

        var result = await service.UploadImageAsync(
            Stream.Null,
            0,
            "image/png",
            CancellationToken.None);

        Assert.Equal("media.file_required", result.Error?.Code);
        Assert.Null(store.Upload);
    }

    [Fact]
    public async Task UploadImageAsync_UnsupportedType_ReturnsUnsupportedFailure()
    {
        var store = new FakeImageStore();
        var service = CreateService(store);

        var result = await service.UploadImageAsync(
            Stream.Null,
            1,
            "image/svg+xml",
            CancellationToken.None);

        Assert.Equal("media.unsupported_type", result.Error?.Code);
        Assert.Null(store.Upload);
    }

    [Fact]
    public async Task UploadImageAsync_FileOverTenMiB_ReturnsTooLargeFailure()
    {
        var store = new FakeImageStore();
        var service = CreateService(store);

        var result = await service.UploadImageAsync(
            Stream.Null,
            MediaService.MaximumFileSizeBytes + 1,
            "image/png",
            CancellationToken.None);

        Assert.Equal("media.file_too_large", result.Error?.Code);
        Assert.Null(store.Upload);
    }

    [Fact]
    public async Task UploadImageAsync_StoreFailure_PreservesStableError()
    {
        var store = new FakeImageStore
        {
            Result = BlogSite.Api.Results.Result<StoredImage>.Failure(
                "media.storage_failed",
                "The image could not be stored.")
        };
        var service = CreateService(store);

        var result = await service.UploadImageAsync(
            Stream.Null,
            1,
            "image/png",
            CancellationToken.None);

        Assert.Equal("media.storage_failed", result.Error?.Code);
    }

    private static MediaService CreateService(IImageStore store) =>
        new(
            store,
            () => new DateTimeOffset(2026, 6, 21, 0, 0, 0, TimeSpan.Zero),
            () => Guid.Parse("7bf42d61-6abc-49ec-a01d-bf1ae57fcfea"),
            "images");

    private sealed class FakeImageStore : IImageStore
    {
        public ImageStoreUpload? Upload { get; private set; }
        public BlogSite.Api.Results.Result<StoredImage> Result { get; init; } =
            BlogSite.Api.Results.Result<StoredImage>.Success(
                new StoredImage("https://media.example.test/image.png"));

        public Task<BlogSite.Api.Results.Result<StoredImage>> UploadAsync(
            ImageStoreUpload upload,
            CancellationToken cancellationToken)
        {
            Upload = upload;
            return Task.FromResult(Result);
        }
    }
}
```

- [ ] **Step 2: Run service tests and verify they fail**

Run:

```bash
dotnet test api.Tests/BlogSite.Api.Tests.csproj \
  --filter FullyQualifiedName~MediaServiceTests
```

Expected: compilation fails because `MediaService` does not exist.

- [ ] **Step 3: Implement the service and response DTO**

Create `api/DTOs/MediaDtos.cs`:

```csharp
namespace BlogSite.Api.DTOs;

public sealed record MediaUploadDto(string Url);
```

Create `api/Services/MediaService.cs`:

```csharp
using BlogSite.Api.DTOs;
using BlogSite.Api.Options;
using BlogSite.Api.Results;
using BlogSite.Api.Storage;
using Microsoft.Extensions.Options;

namespace BlogSite.Api.Services;

public sealed class MediaService
{
    public const long MaximumFileSizeBytes = 10 * 1024 * 1024;
    public const long MaximumRequestSizeBytes =
        MaximumFileSizeBytes + (1024 * 1024);

    private static readonly IReadOnlyDictionary<string, string> AllowedTypes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = ".jpg",
            ["image/png"] = ".png",
            ["image/webp"] = ".webp",
            ["image/gif"] = ".gif"
        };

    private readonly IImageStore imageStore;
    private readonly Func<DateTimeOffset> utcNow;
    private readonly Func<Guid> newId;
    private readonly string pathPrefix;

    public MediaService(
        IImageStore imageStore,
        IOptions<SeaweedFilerOptions> options)
        : this(
            imageStore,
            () => DateTimeOffset.UtcNow,
            Guid.NewGuid,
            options.Value.PathPrefix)
    {
    }

    internal MediaService(
        IImageStore imageStore,
        Func<DateTimeOffset> utcNow,
        Func<Guid> newId,
        string pathPrefix)
    {
        this.imageStore = imageStore;
        this.utcNow = utcNow;
        this.newId = newId;
        this.pathPrefix = pathPrefix;
    }

    public async Task<Result<MediaUploadDto>> UploadImageAsync(
        Stream content,
        long length,
        string? contentType,
        CancellationToken cancellationToken)
    {
        if (length <= 0)
        {
            return Result<MediaUploadDto>.Failure(
                "media.file_required",
                "An image file is required.");
        }

        if (length > MaximumFileSizeBytes)
        {
            return Result<MediaUploadDto>.Failure(
                "media.file_too_large",
                "The image exceeds the 10 MiB limit.");
        }

        if (contentType is null || !AllowedTypes.TryGetValue(contentType, out var extension))
        {
            return Result<MediaUploadDto>.Failure(
                "media.unsupported_type",
                "The image type is not supported.");
        }

        var now = utcNow();
        var objectPath =
            $"{pathPrefix}/{now:yyyy}/{now:MM}/{newId():D}{extension}";
        var stored = await imageStore.UploadAsync(
            new ImageStoreUpload(content, objectPath, contentType),
            cancellationToken);

        return stored.IsFailure
            ? Result<MediaUploadDto>.Failure(
                stored.Error!.Code,
                stored.Error.Message)
            : Result<MediaUploadDto>.Success(
                new MediaUploadDto(stored.Value!.Url));
    }
}
```

Register the service in `api/Extensions/AddImageStorageExtension.cs`:

```csharp
services.AddScoped<MediaService>();
```

Add:

```csharp
using BlogSite.Api.Services;
```

Because the deterministic constructor is `internal`, add to `api/BlogSite.Api.csproj`:

```xml
<ItemGroup>
  <InternalsVisibleTo Include="BlogSite.Api.Tests" />
</ItemGroup>
```

- [ ] **Step 4: Run service and extension tests**

Run:

```bash
dotnet test api.Tests/BlogSite.Api.Tests.csproj \
  --filter "FullyQualifiedName~MediaServiceTests|FullyQualifiedName~AddImageStorageExtensionTests"
```

Expected: all tests pass.

- [ ] **Step 5: Commit the media service**

```bash
git add api/DTOs/MediaDtos.cs \
  api/Services/MediaService.cs \
  api/Extensions/AddImageStorageExtension.cs \
  api/BlogSite.Api.csproj \
  api.Tests/Services/MediaServiceTests.cs
git commit -m "feat(#5): validate image uploads"
```

## Task 4: Expose the multipart media endpoint

**Files:**
- Create: `api/Controllers/MediaController.cs`
- Test: `api.Tests/Controllers/MediaControllerTests.cs`

- [ ] **Step 1: Write failing controller mapping tests**

Create `api.Tests/Controllers/MediaControllerTests.cs`:

```csharp
using BlogSite.Api.Controllers;
using BlogSite.Api.Services;
using BlogSite.Api.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using BlogSite.Api.Options;

namespace BlogSite.Api.Tests.Controllers;

public class MediaControllerTests
{
    [Fact]
    public async Task UploadImage_MissingFile_ReturnsBadRequest()
    {
        var controller = CreateController();

        var result = await controller.UploadImage(null, CancellationToken.None);

        var response = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status400BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UploadImage_UnsupportedType_ReturnsUnsupportedMediaType()
    {
        var controller = CreateController();
        var file = FormFile("image/svg+xml", 3);

        var result = await controller.UploadImage(file, CancellationToken.None);

        var response = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status415UnsupportedMediaType, response.StatusCode);
    }

    [Fact]
    public async Task UploadImage_TooLarge_ReturnsPayloadTooLarge()
    {
        var controller = CreateController();
        var file = FormFile(
            "image/png",
            MediaService.MaximumFileSizeBytes + 1);

        var result = await controller.UploadImage(file, CancellationToken.None);

        var response = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status413PayloadTooLarge, response.StatusCode);
    }

    [Fact]
    public async Task UploadImage_StoreFailure_ReturnsBadGateway()
    {
        var controller = CreateController(storageFailure: true);
        var file = FormFile("image/png", 3);

        var result = await controller.UploadImage(file, CancellationToken.None);

        var response = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status502BadGateway, response.StatusCode);
    }

    [Fact]
    public async Task UploadImage_Success_ReturnsCreatedResponse()
    {
        var controller = CreateController();
        var file = FormFile("image/png", 3);

        var result = await controller.UploadImage(file, CancellationToken.None);

        var response = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status201Created, response.StatusCode);
    }

    private static MediaController CreateController(bool storageFailure = false)
    {
        var store = new FakeImageStore(storageFailure);
        var service = new MediaService(
            store,
            Options.Create(new SeaweedFilerOptions { PathPrefix = "images" }));
        return new MediaController(service);
    }

    private static IFormFile FormFile(string contentType, long length)
    {
        var bytes = new byte[(int)Math.Min(length, 3)];
        return new FormFile(
            new MemoryStream(bytes),
            0,
            length,
            "file",
            "image")
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    private sealed class FakeImageStore(bool storageFailure) : IImageStore
    {
        public Task<BlogSite.Api.Results.Result<StoredImage>> UploadAsync(
            ImageStoreUpload upload,
            CancellationToken cancellationToken) =>
            Task.FromResult(
                storageFailure
                    ? BlogSite.Api.Results.Result<StoredImage>.Failure(
                        "media.storage_failed",
                        "The image could not be stored.")
                    : BlogSite.Api.Results.Result<StoredImage>.Success(
                        new StoredImage("https://media.example.test/image.png")));
    }
}
```

- [ ] **Step 2: Run controller tests and verify they fail**

Run:

```bash
dotnet test api.Tests/BlogSite.Api.Tests.csproj \
  --filter FullyQualifiedName~MediaControllerTests
```

Expected: compilation fails because `MediaController` does not exist.

- [ ] **Step 3: Implement the controller and structured error body**

Create `api/Controllers/MediaController.cs`:

```csharp
using BlogSite.Api.DTOs;
using BlogSite.Api.Results;
using BlogSite.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlogSite.Api.Controllers;

[ApiController]
[Route("api/media")]
public sealed class MediaController(MediaService mediaService) : ControllerBase
{
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
```

The request limit is 11 MiB so multipart envelope overhead does not prevent the
service from accepting a file whose content is exactly 10 MiB. The service remains
authoritative for the 10 MiB image-content limit.

- [ ] **Step 4: Run controller tests and the complete API suite**

Run:

```bash
dotnet test api.Tests/BlogSite.Api.Tests.csproj
dotnet build api/BlogSite.Api.csproj
```

Expected: all tests pass and the API builds without warnings introduced by this work.

- [ ] **Step 5: Commit the endpoint**

```bash
git add api/Controllers/MediaController.cs \
  api.Tests/Controllers/MediaControllerTests.cs
git commit -m "feat(#5): expose image upload endpoint"
```

## Task 5: Add a binary-safe admin upload proxy and client

**Files:**
- Modify: `ui-admin/lib/api-proxy.ts`
- Create: `ui-admin/app/api/media/images/route.ts`
- Modify: `ui-admin/lib/api.ts`
- Test: `ui-admin/__tests__/api-proxy.test.ts`

- [ ] **Step 1: Write a failing multipart proxy test**

Create `ui-admin/__tests__/api-proxy.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { proxyApiRequest } from "@/lib/api-proxy";

describe("proxyApiRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards multipart request bytes without decoding them as text", async () => {
    const bytes = new Uint8Array([0, 255, 1, 2, 3]);
    const backendFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://media.example/image.png" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", backendFetch);
    const request = new Request("http://localhost/api/media/images", {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=test-boundary",
      },
      body: bytes,
    });

    await proxyApiRequest(request, "/api/media/images");

    const init = backendFetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Uint8Array(init.body as ArrayBuffer)).toEqual(bytes);
    expect((init.headers as Headers).get("content-type")).toContain(
      "boundary=test-boundary",
    );
  });
});
```

- [ ] **Step 2: Run the proxy test and verify it fails**

Run:

```bash
npm --prefix ui-admin test -- --run __tests__/api-proxy.test.ts
```

Expected: the body assertion fails because `proxyApiRequest` currently converts the
request to text.

- [ ] **Step 3: Forward non-JSON bodies as bytes**

Replace `buildRequestBody` in `ui-admin/lib/api-proxy.ts`:

```typescript
async function buildRequestBody(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.text();
    return body.length > 0 ? body : undefined;
  }

  const body = await request.arrayBuffer();
  return body.byteLength > 0 ? body : undefined;
}
```

Create `ui-admin/app/api/media/images/route.ts`:

```typescript
import { proxyApiRequest } from "@/lib/api-proxy";

export async function POST(request: Request) {
  return proxyApiRequest(request, "/api/media/images");
}
```

Add to `ui-admin/lib/api.ts`:

```typescript
export interface MediaUpload {
  url: string;
}

export const mediaApi = {
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/media/images", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Image upload failed." }));
      throw new Error(error.message ?? "Image upload failed.");
    }

    return response.json() as Promise<MediaUpload>;
  },
};
```

Do not set `Content-Type`; the browser must generate the multipart boundary.

- [ ] **Step 4: Run the proxy test and admin lint**

Run:

```bash
npm --prefix ui-admin test -- --run __tests__/api-proxy.test.ts
npm --prefix ui-admin run lint
```

Expected: the proxy test passes and lint reports no new errors.

- [ ] **Step 5: Commit the proxy and client**

```bash
git add ui-admin/lib/api-proxy.ts \
  ui-admin/app/api/media/images/route.ts \
  ui-admin/lib/api.ts \
  ui-admin/__tests__/api-proxy.test.ts
git commit -m "feat(#5): proxy image uploads to the API"
```

## Task 6: Build the reusable image upload control

**Files:**
- Create: `ui-admin/components/media/ImageUploadControl.tsx`
- Test: `ui-admin/__tests__/image-upload-control.test.tsx`

- [ ] **Step 1: Write failing component tests**

Create `ui-admin/__tests__/image-upload-control.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ImageUploadControl from "@/components/media/ImageUploadControl";

describe("ImageUploadControl", () => {
  it("uploads a selected file and reports the returned URL", async () => {
    const uploadImage = vi.fn().mockResolvedValue({
      url: "https://media.example/new.png",
    });
    const onUploaded = vi.fn();
    render(
      <ImageUploadControl
        label="Featured image"
        value=""
        onUploaded={onUploaded}
        uploadImage={uploadImage}
      />,
    );

    fireEvent.change(screen.getByLabelText("Featured image"), {
      target: {
        files: [new File(["image"], "image.png", { type: "image/png" })],
      },
    });

    expect(screen.getByRole("button", { name: "Uploading…" })).toBeDisabled();
    await waitFor(() =>
      expect(onUploaded).toHaveBeenCalledWith(
        "https://media.example/new.png",
      ),
    );
  });

  it("preserves the current image and shows an error when upload fails", async () => {
    const onUploaded = vi.fn();
    render(
      <ImageUploadControl
        label="Featured image"
        value="https://media.example/existing.png"
        onUploaded={onUploaded}
        uploadImage={vi.fn().mockRejectedValue(new Error("Storage unavailable"))}
      />,
    );

    fireEvent.change(screen.getByLabelText("Replace Featured image"), {
      target: {
        files: [new File(["image"], "image.png", { type: "image/png" })],
      },
    });

    expect(await screen.findByText("Storage unavailable")).toBeInTheDocument();
    expect(onUploaded).not.toHaveBeenCalled();
    expect(screen.getByAltText("Featured image preview")).toHaveAttribute(
      "src",
      "https://media.example/existing.png",
    );
  });
});
```

- [ ] **Step 2: Run component tests and verify they fail**

Run:

```bash
npm --prefix ui-admin test -- --run __tests__/image-upload-control.test.tsx
```

Expected: compilation fails because `ImageUploadControl` does not exist.

- [ ] **Step 3: Implement the upload control**

Create `ui-admin/components/media/ImageUploadControl.tsx`:

```tsx
"use client";

import { useId, useRef, useState } from "react";

import { mediaApi, type MediaUpload } from "@/lib/api";

interface ImageUploadControlProps {
  label: string;
  value?: string;
  onUploaded: (url: string) => void;
  uploadImage?: (file: File) => Promise<MediaUpload>;
}

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";

export default function ImageUploadControl({
  label,
  value = "",
  onUploaded,
  uploadImage = mediaApi.uploadImage,
}: ImageUploadControlProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const uploaded = await uploadImage(file);
      onUploaded(uploaded.url);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Image upload failed.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  const inputLabel = value ? `Replace ${label}` : label;

  return (
    <div className="space-y-3">
      {value ? (
        // Existing remote URLs are intentional; Next Image would require
        // deployment-specific remotePatterns for the configured media origin.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt={`${label} preview`}
          className="max-h-56 w-full rounded-lg border border-gray-200 object-contain"
        />
      ) : null}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="sr-only"
        aria-label={inputLabel}
        disabled={isUploading}
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        className="inline-flex rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isUploading ? "Uploading…" : value ? "Replace image" : "Choose image"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run component tests and lint**

Run:

```bash
npm --prefix ui-admin test -- --run __tests__/image-upload-control.test.tsx
npm --prefix ui-admin run lint
```

Expected: tests pass and lint has no new errors.

- [ ] **Step 5: Commit the reusable control**

```bash
git add ui-admin/components/media/ImageUploadControl.tsx \
  ui-admin/__tests__/image-upload-control.test.tsx
git commit -m "feat(#5): add image upload control"
```

## Task 7: Integrate uploads into the post editor

**Files:**
- Modify: `ui-admin/components/post-editor/PostEditorForm.tsx`
- Test: `ui-admin/__tests__/post-editor-image-upload.test.tsx`

- [ ] **Step 1: Write focused post-editor image tests**

Create `ui-admin/__tests__/post-editor-image-upload.test.tsx`. Mock organization
requests so the editor reaches a stable state, then cover the three integrations:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PostEditorForm from "@/components/post-editor/PostEditorForm";
import { mediaApi, templatesApi } from "@/lib/api";
import type { LayoutTemplate } from "@/lib/template-schema";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    categoriesApi: { list: vi.fn().mockResolvedValue([]) },
    templatesApi: {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn(),
    },
    mediaApi: { uploadImage: vi.fn() },
  };
});

describe("PostEditorForm image uploads", () => {
  beforeEach(() => {
    vi.mocked(mediaApi.uploadImage).mockReset();
  });

  it("stores a successful featured-image upload", async () => {
    vi.mocked(mediaApi.uploadImage).mockResolvedValue({
      url: "https://media.example/featured.png",
    });
    render(<PostEditorForm mode="create" />);

    fireEvent.change(await screen.findByLabelText("Featured image"), {
      target: {
        files: [new File(["image"], "featured.png", { type: "image/png" })],
      },
    });

    expect(
      await screen.findByAltText("Featured image preview"),
    ).toHaveAttribute("src", "https://media.example/featured.png");
  });

  it("preserves the featured image when replacement fails", async () => {
    vi.mocked(mediaApi.uploadImage).mockRejectedValue(
      new Error("Storage unavailable"),
    );
    render(
      <PostEditorForm
        mode="edit"
        postId={1}
        initialPost={{
          id: 1,
          title: "Post",
          slug: "post",
          content: "",
          featuredImageUrl: "https://media.example/existing.png",
          status: "Draft",
          tags: [],
          createdAt: "2026-06-21T00:00:00Z",
          updatedAt: "2026-06-21T00:00:00Z",
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Replace Featured image"), {
      target: {
        files: [new File(["image"], "new.png", { type: "image/png" })],
      },
    });

    expect(await screen.findByText("Storage unavailable")).toBeInTheDocument();
    expect(screen.getByAltText("Featured image preview")).toHaveAttribute(
      "src",
      "https://media.example/existing.png",
    );
  });
});
```

Add this template fixture containing one `image` block and one `gallery` block:

```typescript
const imageTemplate: LayoutTemplate = {
  id: 7,
  name: "Image template",
  description: "",
  isDefault: false,
  createdAt: "2026-06-21T00:00:00Z",
  updatedAt: "2026-06-21T00:00:00Z",
  layout: {
    version: 1,
    canvas: { width: 960, minRowHeight: 160, backgroundColor: "#ffffff" },
    rootBlockIds: ["image-1", "gallery-1"],
    blocks: {
      "image-1": {
        id: "image-1",
        kind: "image",
        label: "Hero art",
        parentId: null,
        content: {
          key: "hero_art",
          kind: "image",
          label: "Hero art",
        },
      },
      "gallery-1": {
        id: "gallery-1",
        kind: "gallery",
        label: "Gallery",
        parentId: null,
        content: {
          key: "gallery",
          kind: "gallery",
          label: "Gallery",
        },
      },
    },
  },
};
```

Add these tests below the fixture:

```tsx
it("stores a successful template-image upload", async () => {
  vi.mocked(templatesApi.list).mockResolvedValue([imageTemplate]);
  vi.mocked(templatesApi.get).mockResolvedValue(imageTemplate);
  vi.mocked(mediaApi.uploadImage).mockResolvedValue({
    url: "https://media.example/hero.png",
  });
  render(<PostEditorForm mode="create" />);

  fireEvent.change(await screen.findByLabelText("Layout Template"), {
    target: { value: "7" },
  });
  fireEvent.change(await screen.findByLabelText("Hero art"), {
    target: {
      files: [new File(["image"], "hero.png", { type: "image/png" })],
    },
  });

  expect(await screen.findByAltText("Hero art preview")).toHaveAttribute(
    "src",
    "https://media.example/hero.png",
  );
});

it("adds a gallery item only after upload succeeds", async () => {
  let finishUpload:
    | ((value: { url: string }) => void)
    | undefined;
  vi.mocked(templatesApi.list).mockResolvedValue([imageTemplate]);
  vi.mocked(templatesApi.get).mockResolvedValue(imageTemplate);
  vi.mocked(mediaApi.uploadImage).mockReturnValue(
    new Promise((resolve) => {
      finishUpload = resolve;
    }),
  );
  render(<PostEditorForm mode="create" />);

  fireEvent.change(await screen.findByLabelText("Layout Template"), {
    target: { value: "7" },
  });
  fireEvent.change(await screen.findByLabelText("Add Gallery image"), {
    target: {
      files: [new File(["image"], "gallery.png", { type: "image/png" })],
    },
  });

  expect(screen.queryByAltText("Gallery image preview")).not.toBeInTheDocument();
  finishUpload?.({ url: "https://media.example/gallery.png" });

  expect(await screen.findByAltText("Gallery image preview")).toHaveAttribute(
    "src",
    "https://media.example/gallery.png",
  );
});

it("does not add a gallery item when upload fails", async () => {
  vi.mocked(templatesApi.list).mockResolvedValue([imageTemplate]);
  vi.mocked(templatesApi.get).mockResolvedValue(imageTemplate);
  vi.mocked(mediaApi.uploadImage).mockRejectedValue(
    new Error("Storage unavailable"),
  );
  render(<PostEditorForm mode="create" />);

  fireEvent.change(await screen.findByLabelText("Layout Template"), {
    target: { value: "7" },
  });
  fireEvent.change(await screen.findByLabelText("Add Gallery image"), {
    target: {
      files: [new File(["image"], "gallery.png", { type: "image/png" })],
    },
  });

  expect(await screen.findByText("Storage unavailable")).toBeInTheDocument();
  expect(screen.queryByAltText("Gallery image preview")).not.toBeInTheDocument();
  expect(screen.getByText("No gallery images added yet.")).toBeInTheDocument();
});
```

In `beforeEach`, also reset and restore the default template mocks:

```tsx
vi.mocked(templatesApi.list).mockReset();
vi.mocked(templatesApi.list).mockResolvedValue([]);
vi.mocked(templatesApi.get).mockReset();
```

- [ ] **Step 2: Run the post-editor tests and verify they fail**

Run:

```bash
npm --prefix ui-admin test -- --run __tests__/post-editor-image-upload.test.tsx
```

Expected: tests fail because the editor still renders URL inputs.

- [ ] **Step 3: Replace featured and template image URL inputs**

Import:

```tsx
import ImageUploadControl from "@/components/media/ImageUploadControl";
```

Add `aria-label="Layout Template"` to the existing layout-template `<select>` so
the generated editor can be selected accessibly and reliably in tests.

Replace the featured-image `<input type="url">` with:

```tsx
<ImageUploadControl
  label="Featured image"
  value={featuredImageUrl}
  onUploaded={setFeaturedImageUrl}
/>
```

In the `image` block branch, replace only the URL input with:

```tsx
<ImageUploadControl
  label={block.label}
  value={imageValue.url}
  onUploaded={(url) =>
    onImageChange(block.content.key, (currentValue) => ({
      ...currentValue,
      url,
    }))
  }
/>
```

Keep the existing alt-text and caption inputs unchanged.

- [ ] **Step 4: Replace gallery URL entry with upload-first insertion**

Change `TemplateContentFieldProps`:

```tsx
onGalleryItemAdd: (
  bindingKey: string,
  uploadedUrl: string,
) => void;
```

Change the parent callback:

```tsx
function addTemplateGalleryItem(
  bindingKey: string,
  uploadedUrl: string,
) {
  setTemplateContentValues((currentValues) => ({
    ...currentValues,
    [bindingKey]: [
      ...asGalleryValue(currentValues[bindingKey]),
      {
        id: crypto.randomUUID(),
        url: uploadedUrl,
        alt: "",
        caption: "",
      },
    ],
  }));
}
```

Replace the gallery's Add Image button with:

```tsx
<ImageUploadControl
  label={`Add ${block.label} image`}
  onUploaded={(url) => onGalleryItemAdd(block.content.key, url)}
/>
```

For each existing gallery item, replace the URL input with:

```tsx
<ImageUploadControl
  label={`${block.label} image`}
  value={item.url}
  onUploaded={(url) =>
    onGalleryItemChange(
      block.content.key,
      item.id,
      (currentItem) => ({
        ...currentItem,
        url,
      }),
    )
  }
/>
```

Keep alt, caption, and Remove controls unchanged. Because the gallery item is
created only in `onUploaded`, failed uploads cannot append empty items.

- [ ] **Step 5: Run focused and complete admin tests**

Run:

```bash
npm --prefix ui-admin test -- --run __tests__/post-editor-image-upload.test.tsx
npm --prefix ui-admin test
npm --prefix ui-admin run lint
```

Expected: focused and complete tests pass; lint reports no new errors.

- [ ] **Step 6: Commit the editor integration**

```bash
git add ui-admin/components/post-editor/PostEditorForm.tsx \
  ui-admin/__tests__/post-editor-image-upload.test.tsx
git commit -m "feat(#5): use uploads in post image fields"
```

## Task 8: Complete verification and documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run formatting checks**

Run:

```bash
dotnet format api/BlogSite.Api.csproj --verify-no-changes
git diff --check
```

Expected: both commands exit successfully. If `dotnet format` reports only files
changed by this implementation, run:

```bash
dotnet format api/BlogSite.Api.csproj
```

Review the formatting diff before continuing.

- [ ] **Step 2: Run the complete API verification**

Run:

```bash
dotnet test api.Tests/BlogSite.Api.Tests.csproj
dotnet build api/BlogSite.Api.csproj
```

Expected: all tests pass and the API build succeeds.

- [ ] **Step 3: Run the complete admin verification**

Run:

```bash
npm --prefix ui-admin test
npm --prefix ui-admin run lint
npm --prefix ui-admin run build
```

Expected: all tests pass, lint succeeds, and the production build completes.

- [ ] **Step 4: Perform a local integration smoke test**

With SeaweedFS Filer running at the configured private URL:

```bash
curl -i \
  -F "file=@/path/to/test-image.png;type=image/png" \
  http://localhost:5000/api/media/images
```

Expected:

- HTTP `201`;
- JSON contains a URL under the configured public media origin;
- requesting that URL returns the uploaded image;
- the object path follows `images/YYYY/MM/{uuid}.png`.

Also verify in the admin UI:

- featured image upload and replacement;
- template image upload and replacement;
- gallery upload, replacement, alt/caption editing, and removal;
- a failed Filer request leaves existing editor state unchanged.

If a local SeaweedFS instance is unavailable, report the smoke test as not run; do
not claim live integration success based only on mocked tests.

- [ ] **Step 5: Document configuration**

Add this concise SeaweedFS section to `README.md` after the API run instructions:

```markdown
### SeaweedFS image storage

Configure the API's `SeaweedFiler` section:

- `PrivateBaseUrl`: internal Filer upload endpoint
- `PublicBaseUrl`: browser-accessible media origin
- `PathPrefix`: object namespace, default `images`

The admin UI uploads through the .NET API; it does not connect to SeaweedFS
directly.
```

- [ ] **Step 6: Review issue scope and working tree**

Run:

```bash
git status --short
git diff --stat origin/main...HEAD
git log --oneline origin/main..HEAD
```

Expected:

- only issue #5 implementation and documentation files are changed;
- every commit references `#5`;
- no environment files, credentials, generated build output, or uploaded images are
  tracked.

- [ ] **Step 7: Commit final documentation or verification fixes**

If documentation changed:

```bash
git add README.md
git commit -m "docs(#5): document SeaweedFS configuration"
```

If verification required code fixes, commit each coherent fix separately with a
`#5` reference, rerun the failed verification command, then rerun the full relevant
suite.
