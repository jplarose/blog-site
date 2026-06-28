# SeaweedFS Image Store Design

## Objective

Add image uploads to the admin post editor using a storage abstraction owned by the
.NET API. The initial implementation stores images through the SeaweedFS Filer HTTP
API and returns public URLs that the existing post models persist.

The feature covers featured images, template image blocks, and template gallery
items. It does not add a media library, image transformations, deletion, or manual
image URL entry.

## Architecture

The upload flow is:

1. The admin UI sends a selected image to `POST /api/media/images`.
2. The API validates the multipart upload.
3. `MediaController` calls `IImageStore`.
4. `SeaweedFilerImageStore` uploads the stream to SeaweedFS through its private
   Filer HTTP endpoint.
5. The store returns a URL built from a separately configured public media base
   URL.
6. The admin editor stores that URL in its existing post state.
7. The existing JSON post create or update request persists the URL.

The upload is independent of post persistence. This avoids multipart post models,
allows immediate upload feedback, and keeps image storage reusable outside posts.
No database schema or post API contract changes are required.

## API Contract

### Endpoint

`POST /api/media/images`

The request uses `multipart/form-data` with one field named `file`.

The successful response is HTTP `201 Created` with:

```json
{
  "url": "https://media.example.com/images/2026/06/7bf42d61-6abc-49ec-a01d-bf1ae57fcfea.webp"
}
```

The endpoint follows the API's current authorization posture. It will not introduce
a new authentication system as part of issue #5. Keeping uploads in a dedicated
controller leaves a clear boundary for adding authorization later.

### Validation

The controller accepts:

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`

The maximum file size is 10 MiB. Empty files are rejected. SVG is excluded because
serving user-controlled SVG can introduce active-content and script risks.

The server generates every object name. Client-supplied paths and filenames are
never used for storage addressing. The extension is selected from the validated
MIME type:

- `image/jpeg` → `.jpg`
- `image/png` → `.png`
- `image/webp` → `.webp`
- `image/gif` → `.gif`

Objects use a date-partitioned path:

`{pathPrefix}/{yyyy}/{MM}/{uuid}.{extension}`

The default path prefix is `images`.

### Error Responses

Expected failures use a structured response containing a stable code and safe
message:

| Status | Code | Condition |
| --- | --- | --- |
| `400 Bad Request` | `media.file_required` | The multipart field is absent or empty |
| `413 Payload Too Large` | `media.file_too_large` | The file exceeds 10 MiB |
| `415 Unsupported Media Type` | `media.unsupported_type` | The MIME type is not allowed |
| `502 Bad Gateway` | `media.storage_failed` | SeaweedFS rejects the upload or cannot be reached |

Storage failures are logged with the generated object path and upstream status when
available. Logs must not contain file bytes, credentials, or sensitive
configuration values.

## Storage Boundary

`IImageStore` defines the application-facing contract. It accepts:

- the image stream
- the generated object path
- the validated content type
- a cancellation token

It returns a result containing the public image URL or an expected storage failure.
The interface does not expose SeaweedFS response models or Filer-specific concepts.

`SeaweedFilerImageStore` implements this contract with a configured `HttpClient`.
It sends the image to the private Filer endpoint using multipart HTTP upload and
passes cancellation through every asynchronous operation.

The implementation treats any non-success Filer response as a storage failure. It
does not expose the upstream response body to clients. The SeaweedFS HTTP client
uses a bounded retry policy for connection failures, `408`, `429`, and `5xx`
responses. It makes no more than three total attempts. Because validation caps each
upload at 10 MiB, the adapter may use bounded buffering when required to make the
request body safely repeatable.

## Configuration

The API binds and validates a dedicated options object at startup:

| Setting | Purpose |
| --- | --- |
| `PrivateBaseUrl` | Internal SeaweedFS Filer address used for uploads |
| `PublicBaseUrl` | Browser-accessible media origin used in returned URLs |
| `PathPrefix` | Optional storage namespace; defaults to `images` |

Both base URLs are required absolute HTTP or HTTPS URLs. URL construction trims
duplicate separators so configuration does not affect generated paths.

The initial Filer deployment does not require credentials. Authentication headers
can be added inside the adapter later without changing the controller or UI
contract.

## Admin UI Behavior

The featured-image field, template image fields, and gallery image controls accept
local files only. Manual URL editing is removed.

For a single-image field:

1. The user selects a file.
2. The control uploads it immediately.
3. The control is disabled and displays an uploading state.
4. On success, the returned URL replaces the field's existing URL.
5. The editor displays a preview and a Replace action.

Existing posts with stored image URLs continue to display previews. A user can
replace those images but cannot edit their URLs directly.

For a gallery:

1. The user selects a file through Add Image.
2. The file uploads immediately.
3. A new gallery item is appended only after upload succeeds.
4. Alt text and caption remain editable for the new item.

Upload errors are displayed beside the affected control. A failed upload preserves
the prior single-image value and does not append a gallery item.

The UI upload client sends `FormData` to a same-origin Next.js route that only
forwards the multipart request and response to the .NET endpoint. Validation,
storage decisions, generated paths, and error mapping remain owned by .NET. The
client and proxy do not set a JSON `Content-Type` header, allowing the multipart
boundary to be generated correctly. Existing post submission remains JSON and
continues to persist the returned URLs through `featuredImageUrl` and template
content values.

## Testing

### API

High-value controller and service tests cover:

- successful upload and returned public URL
- missing and empty files
- unsupported MIME types
- files larger than 10 MiB
- storage failure mapped to `502`
- request cancellation passed to the storage boundary

Storage adapter tests use a controlled HTTP message handler to verify:

- the private Filer request URL and generated object path
- multipart file content and validated content type
- successful public URL construction
- non-success upstream responses becoming storage failures
- cancellation reaching the HTTP request

### Admin UI

Component tests cover:

- successful featured-image replacement
- successful template-image replacement
- failed replacement preserving the prior image
- gallery insertion only after upload success
- loading and disabled states during upload
- upload errors rendered at the affected control

### Verification

Before completion:

- run all API tests
- build the API
- run all admin UI tests
- run admin UI lint
- build the admin UI

## Out of Scope

- Image deletion or orphan cleanup
- Browsable media library
- Image resizing, optimization, or thumbnail generation
- Direct browser-to-SeaweedFS uploads
- S3-compatible SeaweedFS access
- Database schema changes
- A new API authentication implementation
- Manual image URL entry
