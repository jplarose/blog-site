# PostgreSQL Registration Extension Design

## Goal

Update the API's PostgreSQL dependency injection setup to consume the structured
`DataSource` configuration in `api/appsettings.json` and keep database
registration out of `Program.cs`.

## Structure

- Add `api/Options/DataSourceOptions.cs` to represent the `DataSource` section:
  `Host`, `Database`, `User`, and `Password`.
- Add `api/Extensions/AddPostgresExtension.cs` with an `AddPostgres` extension
  method for `IServiceCollection`.
- Replace the inline PostgreSQL registrations in `api/Program.cs` with
  `builder.Services.AddPostgres(builder.Configuration)`.

## Registration Behavior

`AddPostgres` will bind the `DataSource` configuration section, validate that
all four required values are present, and create an `NpgsqlDataSource` from an
`NpgsqlConnectionStringBuilder`. The configured `User` value maps to Npgsql's
`Username` property.

The `NpgsqlDataSource` remains a singleton. Each repository scope receives a
scoped `IDbConnection` created from that data source.

The extension will not synchronously open connections during dependency
resolution. Repositories will continue to open connections asynchronously
through `RepositoryConnection.EnsureOpenAsync`, preserving cancellation-token
support and avoiding synchronous database I/O in the DI factory.

## Failure Handling

If any required `DataSource` value is absent or whitespace, resolving the data
source will throw an `InvalidOperationException` with a configuration-specific
message. Secrets will not be included in the error.

## Verification

Add a focused test that supplies in-memory `DataSource` configuration, resolves
the registered services, and verifies:

- `NpgsqlDataSource` is registered.
- Scoped `IDbConnection` resolves as an Npgsql connection.
- The generated connection uses the configured host, database, and username.
- Incomplete configuration fails with the expected startup configuration error.

Run the API test suite and build after implementation.
